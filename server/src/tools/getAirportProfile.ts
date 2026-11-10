import type { ToolResult } from "@airport/shared";
import { prisma } from "../db.js";
import { delaySummary } from "../db/delay.js";
import { FORECAST_FROM_FY, FORECAST_TO_FY, loadMetrics } from "../db/metrics.js";
import { scoreAirports } from "../scoring/index.js";
import { airportFlags } from "./rankAirports.js";
import { result, round, scoringMethodology, SRC } from "./common.js";

const cagr = (from: number | undefined, to: number | undefined, years: number) =>
  from && to && from > 0 && to > 0 ? Math.pow(to / from, 1 / years) - 1 : null;

export async function getAirportProfile(input: { airport: string }): Promise<ToolResult> {
  const code = input.airport.toUpperCase();
  const loaded = await loadMetrics(prisma);
  const ap = await prisma.airport.findUnique({ where: { airport: code } });
  const m = await prisma.airportMetric.findUnique({ where: { airport: code } });
  if (!ap || !m) throw new Error(`Unknown airport "${code}". In-scope airports: ${loaded.metrics.map((x) => x.iata).join(", ")}.`);
  const w = loaded.window;

  const [monthly, fares, fc, delays] = await Promise.all([
    prisma.routeStat.groupBy({
      by: ["period"],
      where: { origin: code, period: { gte: w.from, lte: w.to } },
      _sum: { passengers: true, seats: true, departures: true },
      orderBy: { period: "asc" },
    }),
    prisma.fare.findMany({ where: { airport: code }, orderBy: [{ year: "asc" }, { quarter: "asc" }] }),
    prisma.forecast.findMany({ where: { airport: code }, orderBy: { fiscalYear: "asc" } }),
    delaySummary(prisma, [code], w),
  ]);

  const score = scoreAirports(loaded.metrics).find((s) => s.iata === code)!;
  const inp = loaded.inputs.get(code)!;

  const last4 = fares.slice(-4);
  const prior4 = fares.slice(-8, -4);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const latestFare = fares[fares.length - 1];

  const fy = (y: number) => fc.find((r) => r.fiscalYear === y);
  const d = delays.get(code)!;

  const flags = [...loaded.globalFlags, ...airportFlags(score, loaded)];
  if (latestFare?.isProvisional) flags.push({ code: "PROVISIONAL_FARE", severity: "info", message: `${latestFare.period} fares are provisional`, detail: `${latestFare.period} is the latest quarter and is marked provisional in the BTS fares file.` });

  return result({
    data: {
      airport: code,
      metadata: {
        name: ap.name,
        icao: ap.icaoIdent,
        city: ap.city,
        state: ap.state,
        regionGroup: ap.regionGroup,
        type: ap.airportType,
        scheduledService: ap.scheduledService,
        latitude: ap.latitude,
        longitude: ap.longitude,
        tafHubSize: ap.tafHubSize,
        tafFacilityClass: ap.tafFacilityClass,
      },
      runways: { open: ap.openRunways, closed: ap.closedRunways, longestOpenFt: ap.longestOpenRunwayFt },
      traffic: {
        window: w.label,
        paxLast12m: m.paxLast12m,
        paxPrior12m: m.paxPrior12m,
        paxLatestFullYear: { year: m.latestFullYear, pax: m.paxLatestFullYear },
        pax2019: m.pax2019,
        departuresLast12m: m.departuresLast12m,
        seatsLast12m: m.seatsLast12m,
        monthlyPax: monthly.map((r) => ({
          period: r.period,
          passengers: r._sum.passengers,
          seats: r._sum.seats,
          departures: r._sum.departures,
        })),
      },
      loadFactor: {
        last12m: m.loadFactorLast12m,
        prior12m: m.loadFactorPrior12m,
        latestFullYear: m.loadFactorLatestFullYear,
        y2019: m.loadFactor2019,
      },
      growth: {
        last12mVsPrior12mPct: { value: round(m.growthLast12mVsPrior12mPct, 2), windows: `${m.last12mWindow} vs ${m.prior12mWindow}` },
        latestFullYearVs2019Pct: { value: round(m.growthLatestFullYearVs2019Pct, 2), years: `${m.latestFullYear} vs 2019` },
        note: "Two definitions: (a) recent momentum, (b) recovery vs the pre-COVID baseline. The scoring model uses trailing-12m pax / 2019 pax plus the TAF CAGR.",
      },
      fare: {
        latestQuarter: latestFare && { period: latestFare.period, avgFareUsd: round(latestFare.avgFareUsd, 2), vsPeerMedian: round(latestFare.fareVsBenchmark, 4), provisional: latestFare.isProvisional },
        last4Quarters: last4.map((f) => ({ period: f.period, avgFareUsd: round(f.avgFareUsd, 2), peerMedianUsd: round(f.benchmarkMedianFareUsd, 2), vsPeerMedian: round(f.fareVsBenchmark, 4) })),
        meanVsPeerMedianLast4q: round(mean(last4.map((f) => f.fareVsBenchmark)), 4),
        meanVsPeerMedianPrior4q: round(mean(prior4.map((f) => f.fareVsBenchmark)), 4),
        peerMedianDefinition: "median of the 16 in-scope airports in the same quarter",
      },
      tafForecast: {
        enplanementsFY2024Actual: fy(2024)?.enplanementsTotal ?? null,
        enplanementsFY2025: fy(FORECAST_FROM_FY)?.enplanementsTotal ?? null,
        enplanementsFY2030: fy(FORECAST_TO_FY)?.enplanementsTotal ?? null,
        enplanementsFY2035: fy(2035)?.enplanementsTotal ?? null,
        cagrFY2025toFY2030: round(cagr(fy(2025)?.enplanementsTotal, fy(2030)?.enplanementsTotal, 5), 5),
        cagrFY2025toFY2035: round(cagr(fy(2025)?.enplanementsTotal, fy(2035)?.enplanementsTotal, 10), 5),
        commercialOpsFY2025: fy(2025)?.opsCommercial ?? null,
        commercialOpsFY2030: fy(2030)?.opsCommercial ?? null,
      },
      congestion: {
        window: d.window,
        eligibleForScoring: d.delayScoreEligible,
        coverageOfT100DeparturesPct: round(d.coverageWindowPct, 1),
        arrivalNasDelayRatePct: d.arr?.nasDelayRate == null ? null : round(d.arr.nasDelayRate * 100, 2),
        arrivalDelayed15Pct: d.arr?.delayed15Share == null ? null : round(d.arr.delayed15Share * 100, 2),
        departureDelayed15Pct: d.dep?.delayed15Share == null ? null : round(d.dep.delayed15Share * 100, 2),
        usedInScoring: inp.delay.nasDelayShareArr,
      },
      score: {
        peerSet: "all 16 in-scope airports",
        rank: score.rank,
        total: round(score.total, 2),
        confidence: score.confidence,
        scores: Object.fromEntries(Object.values(score.components).map((c) => [c.component, round(c.score, 2)])),
      },
    },
    sources: [SRC.ourairports, SRC.t100, SRC.fares, SRC.taf, SRC.ontime],
    assumptions: [
      `Passengers are enplaned passengers on an origin basis (T-100 passenger classes F/L); trailing 12 months = ${w.label}.`,
      "Load factor = sum(passengers) / sum(seats) over route rows with seats > 0 and departures > 0 (never an average of row ratios).",
      "Fare is the origin-airport average DOMESTIC itinerary fare (no route/carrier split) relative to the median of the 16 in-scope airports, which is California-heavy and not a national benchmark.",
      "TAF is by fiscal year (Oct-Sep) and FY2025 is itself a forecast; use TAF for growth ratios, not levels. Enplanement totals include international.",
      "Runway counts exclude closed runways. No source has gates or terminal size.",
    ],
    flags,
    methodology: scoringMethodology(),
  });
}
