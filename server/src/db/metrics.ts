import type { PrismaClient } from "@prisma/client";
import type { ToolFlag } from "@airport/shared";
import type { AirportMetrics } from "../scoring/index.js";
import { dataQualityFlags, fareBenchmark, partial2026 } from "../tools/flags.js";

/** TAF forecast horizon used for the growth component: CAGR of total enplanements, FY2025 -> FY2030. */
export const FORECAST_FROM_FY = 2025;
export const FORECAST_TO_FY = 2030;
/** An airport is "cargo heavy" when all-cargo (G/P) departures exceed this share of all its departures. */
export const CARGO_HEAVY_SHARE = 0.5;
/** Pricing power uses the mean fare-vs-benchmark ratio over the latest N quarters (smooths seasonality/small samples). */
export const FARE_QUARTERS = 4;

export interface Window {
  /** "YYYY-MM" inclusive */
  from: string;
  to: string;
  label: string;
}

/** "202507-202606" -> { from: "2025-07", to: "2026-06" } */
export function parseWindow(w: string): Window {
  const m = /^(\d{4})(\d{2})-(\d{4})(\d{2})$/.exec(w);
  if (!m) throw new Error(`Unrecognised window "${w}"`);
  return { from: `${m[1]}-${m[2]}`, to: `${m[3]}-${m[4]}`, label: `${m[1]}-${m[2]}..${m[3]}-${m[4]}` };
}

export interface MetricInputs {
  iata: string;
  name: string;
  regionGroup: string;
  state: string;
  /** Raw values that fed the scoring engine, with provenance, for the evidence panel. */
  delay: { nasDelayShareArr: number | null; eligible: boolean; coverageWindowPct: number | null; flownArr: number };
  fare: { ratio: number | null; quarters: string[] };
  forecast: { cagr: number | null; enplanementsFrom: number | null; enplanementsTo: number | null };
  cargo: { departuresShare: number | null; cargoDepartures: number; passengerDepartures: number };
}

export interface LoadedMetrics {
  window: Window;
  /** Scoring-engine input, sorted by IATA. */
  metrics: AirportMetrics[];
  inputs: Map<string, MetricInputs>;
  /** Per-airport data-quality flags from data_quality_flags.csv (dep/arr duplicates merged). */
  airportNotes: Map<string, ToolFlag[]>;
  /** Flags that apply to every metric (partial 2026, fare benchmark, ...). */
  globalFlags: ToolFlag[];
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/**
 * Read AirportMetric + DataQualityFlag (+ the few inputs the CSV does not hold: delay rate, fare ratio, TAF CAGR,
 * cargo share) and map them to the scoring engine's AirportMetrics. Nothing in airport_metrics.csv is recomputed.
 * Missing/ineligible values are passed as null so the engine drops and re-normalizes them.
 */
export async function loadMetrics(prisma: PrismaClient, only?: string[]): Promise<LoadedMetrics> {
  const codes = only?.map((c) => c.toUpperCase());
  const where = codes ? { airport: { in: codes } } : {};
  const [airports, metricRows, flagRows] = await Promise.all([
    prisma.airport.findMany({ where, orderBy: { airport: "asc" } }),
    prisma.airportMetric.findMany({ where }),
    prisma.dataQualityFlag.findMany({ orderBy: { id: "asc" } }),
  ]);
  if (codes) {
    const missing = codes.filter((c) => !airports.some((a) => a.airport === c));
    if (missing.length) throw new Error(`Unknown airport(s): ${missing.join(", ")}. In-scope airports are the 16 in data/clean/airports.csv.`);
  }
  if (!metricRows.length) throw new Error("airport_metrics is empty: run `npm run seed`");
  const win = parseWindow(metricRows[0].last12mWindow);
  const list = airports.map((a) => a.airport);

  const [delayRows, fareRows, fcRows, paxDep, cargoDep] = await Promise.all([
    prisma.delayStat.findMany({
      where: { airport: { in: list }, direction: "arr", period: { gte: win.from, lte: win.to } },
      select: { airport: true, nasDelayedFlights: true, flown: true, delayScoreEligible: true, coverageWindowPct: true },
    }),
    prisma.fare.findMany({ where: { airport: { in: list } }, orderBy: [{ year: "asc" }, { quarter: "asc" }] }),
    prisma.forecast.findMany({
      where: { airport: { in: list }, fiscalYear: { in: [FORECAST_FROM_FY, FORECAST_TO_FY] } },
      select: { airport: true, fiscalYear: true, enplanementsTotal: true },
    }),
    prisma.routeStat.groupBy({ by: ["origin"], where: { origin: { in: list }, period: { gte: win.from, lte: win.to } }, _sum: { departures: true } }),
    prisma.cargoRouteStat.groupBy({ by: ["origin"], where: { origin: { in: list }, period: { gte: win.from, lte: win.to } }, _sum: { departures: true } }),
  ]);

  const quarters = uniq(fareRows.map((f) => f.period)).slice(-FARE_QUARTERS);
  const metricBy = new Map(metricRows.map((m) => [m.airport, m]));
  const inputs = new Map<string, MetricInputs>();
  const metrics: AirportMetrics[] = [];
  const airportNotes = new Map<string, ToolFlag[]>();

  for (const a of airports) {
    const m = metricBy.get(a.airport);
    if (!m) throw new Error(`No airport_metrics row for ${a.airport}`);

    const d = delayRows.filter((r) => r.airport === a.airport);
    const flown = d.reduce((s, r) => s + r.flown, 0);
    const nas = d.reduce((s, r) => s + r.nasDelayedFlights, 0);
    const eligible = d.length > 0 && d.every((r) => r.delayScoreEligible);
    const delayRate = eligible && flown > 0 ? nas / flown : null;

    const f = fareRows.filter((r) => r.airport === a.airport && quarters.includes(r.period));
    const fareRatio = f.length === quarters.length ? f.reduce((s, r) => s + r.fareVsBenchmark, 0) / f.length : null;

    const from = fcRows.find((r) => r.airport === a.airport && r.fiscalYear === FORECAST_FROM_FY)?.enplanementsTotal ?? null;
    const to = fcRows.find((r) => r.airport === a.airport && r.fiscalYear === FORECAST_TO_FY)?.enplanementsTotal ?? null;
    const cagr = from && to && from > 0 && to > 0 ? Math.pow(to / from, 1 / (FORECAST_TO_FY - FORECAST_FROM_FY)) - 1 : null;

    const pd = paxDep.find((r) => r.origin === a.airport)?._sum.departures ?? 0;
    const cd = cargoDep.find((r) => r.origin === a.airport)?._sum.departures ?? 0;
    const cargoShare = pd + cd > 0 ? cd / (pd + cd) : null;

    metrics.push({
      iata: a.airport,
      loadFactor12m: m.loadFactorLast12m,
      pax12m: m.paxLast12m,
      paxBaseline2019: m.pax2019,
      forecastCagr: cagr,
      delayRate,
      fareRatio,
      flags: { cargoHeavy: cargoShare !== null && cargoShare > CARGO_HEAVY_SHARE },
    });
    inputs.set(a.airport, {
      iata: a.airport,
      name: a.name,
      regionGroup: a.regionGroup,
      state: a.state,
      delay: { nasDelayShareArr: delayRate, eligible, coverageWindowPct: d[0]?.coverageWindowPct ?? null, flownArr: flown },
      fare: { ratio: fareRatio, quarters },
      forecast: { cagr, enplanementsFrom: from, enplanementsTo: to },
      cargo: { departuresShare: cargoShare, cargoDepartures: cd, passengerDepartures: pd },
    });

    airportNotes.set(a.airport, dataQualityFlags(flagRows.filter((r) => r.airport === a.airport)));
  }

  const globalFlags = [partial2026(win), fareBenchmark(quarters[quarters.length - 1])];
  return { window: win, metrics, inputs, airportNotes, globalFlags };
}
