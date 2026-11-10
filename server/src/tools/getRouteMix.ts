import type { ToolFlag, ToolResult } from "@airport/shared";
import { prisma } from "../db.js";
import { CARGO_HEAVY_SHARE } from "../db/metrics.js";
import { longHaulShare, type LongHaulResult } from "../scoring/index.js";
import { result, round, SRC, uniq } from "./common.js";
import { cargoHeavy } from "./flags.js";

/** Calendar year used for the route mix: the latest full year in T-100 (2026 is partial). */
export const ROUTE_MIX_YEAR = 2025;
export const REFERENCE_CUTOFFS_MI = [1500, 2500, 3000];

const pct = (x: number | null) => (x === null ? null : round(x * 100, 2));
const shareRow = (r: LongHaulResult) => ({
  cutoffMi: r.cutoffMi,
  longHaulDepartures: r.longHaulDepartures,
  totalDepartures: r.totalDepartures,
  sharePct: pct(r.share),
  explanation: r.explanation,
});

export async function getRouteMix(input: { airport: string; cutoffMi?: number; topN?: number }): Promise<ToolResult> {
  const code = input.airport.toUpperCase();
  const cutoff = input.cutoffMi ?? 3000;
  const topN = input.topN ?? 10;
  const ap = await prisma.airport.findUnique({ where: { airport: code } });
  if (!ap) throw new Error(`Unknown airport "${code}".`);

  const base = { origin: code, year: ROUTE_MIX_YEAR, distanceValid: true };
  const [paxByDist, cargoByDist, paxByDest, cargoByDest, paxInvalid, cargoInvalid, paxYears, cargoYears] = await Promise.all([
    prisma.routeStat.groupBy({ by: ["distance"], where: base, _sum: { departures: true } }),
    prisma.cargoRouteStat.groupBy({ by: ["distance"], where: base, _sum: { departures: true } }),
    prisma.routeStat.groupBy({ by: ["dest", "distance"], where: base, _sum: { departures: true, passengers: true, seats: true } }),
    prisma.cargoRouteStat.groupBy({ by: ["dest", "distance"], where: base, _sum: { departures: true, freightLbs: true } }),
    prisma.routeStat.aggregate({ where: { origin: code, year: ROUTE_MIX_YEAR, distanceValid: false }, _sum: { departures: true } }),
    prisma.cargoRouteStat.aggregate({ where: { origin: code, year: ROUTE_MIX_YEAR, distanceValid: false }, _sum: { departures: true } }),
    prisma.routeStat.groupBy({ by: ["year", "distance"], where: { origin: code, distanceValid: true, isPartialYear: false }, _sum: { departures: true } }),
    prisma.cargoRouteStat.groupBy({ by: ["year", "distance"], where: { origin: code, distanceValid: true, isPartialYear: false }, _sum: { departures: true } }),
  ]);

  const toDep = (rows: { distance: number; _sum: { departures: number | null } }[]) =>
    rows.map((r) => ({ distanceMi: r.distance, departures: r._sum.departures ?? 0 }));
  const pax = toDep(paxByDist);
  const cargo = toDep(cargoByDist);
  const both = [...pax, ...cargo];

  const cutoffs = uniq([...REFERENCE_CUTOFFS_MI, cutoff]).sort((x, y) => x - y);
  const atCutoffs = cutoffs.map((c) => ({
    cutoffMi: c,
    isRequested: c === cutoff,
    passengerOnly: shareRow(longHaulShare(pax, c)),
    includingCargo: shareRow(longHaulShare(both, c)),
  }));
  const requested = atCutoffs.find((x) => x.isRequested)!;

  const passengerTotal = pax.reduce((s, x) => s + x.departures, 0);
  const cargoTotal = cargo.reduce((s, x) => s + x.departures, 0);
  const cargoShare = passengerTotal + cargoTotal > 0 ? cargoTotal / (passengerTotal + cargoTotal) : null;

  const byYear = [...new Set([...paxYears.map((r) => r.year), ...cargoYears.map((r) => r.year)])]
    .sort((x, y) => x - y)
    .map((year) => {
      const p = toDep(paxYears.filter((r) => r.year === year));
      const c = toDep(cargoYears.filter((r) => r.year === year));
      return { year, passengerOnlySharePct: pct(longHaulShare(p, cutoff).share), includingCargoSharePct: pct(longHaulShare([...p, ...c], cutoff).share) };
    });

  const topPassenger = paxByDest
    .map((r) => ({
      dest: r.dest,
      distanceMi: r.distance,
      departures: r._sum.departures ?? 0,
      passengers: r._sum.passengers ?? 0,
      loadFactor: r._sum.seats ? round((r._sum.passengers ?? 0) / r._sum.seats, 4) : null,
      longHaul: r.distance >= cutoff,
    }))
    .sort((x, y) => y.departures - x.departures || (x.dest < y.dest ? -1 : 1))
    .slice(0, topN)
    .map((r) => ({ ...r, shareOfPassengerDeparturesPct: pct(passengerTotal > 0 ? r.departures / passengerTotal : null) }));
  const topCargo = cargoByDest
    .map((r) => ({ dest: r.dest, distanceMi: r.distance, departures: r._sum.departures ?? 0, freightLbs: r._sum.freightLbs ?? 0, longHaul: r.distance >= cutoff }))
    .sort((x, y) => y.departures - x.departures || (x.dest < y.dest ? -1 : 1))
    .slice(0, topN);

  const lo = Math.min(...atCutoffs.map((x) => x.passengerOnly.sharePct ?? 0));
  const hi = Math.max(...atCutoffs.map((x) => x.passengerOnly.sharePct ?? 0));
  const flags: ToolFlag[] = [
    {
      code: "PARTIAL_2026",
      severity: "info",
      message: `${ROUTE_MIX_YEAR} used; partial 2026 excluded`,
      detail: `${ROUTE_MIX_YEAR} is the latest FULL calendar year; 2026 (T-100 through 2026-07) is excluded from shares and from the by-year trend.`,
    },
    {
      code: "DEFINITION_SENSITIVE",
      severity: "warn",
      message: `Share is ${lo}%-${hi}% depending on cutoff`,
      detail: `Passenger-only long-haul share ranges ${lo}%-${hi}% across the ${cutoffs.join("/")} mi cutoffs; state the cutoff with any number.`,
    },
  ];
  if (cargoShare !== null && cargoShare > CARGO_HEAVY_SHARE) {
    flags.push(
      cargoHeavy(
        code,
        cargoShare * 100,
        `All-cargo freighters are ${(cargoShare * 100).toFixed(1)}% of ${ROUTE_MIX_YEAR} departures; the long-haul share at ${cutoff} mi is ${requested.passengerOnly.sharePct}% for passenger flights but ${requested.includingCargo.sharePct}% including cargo, so the answer depends on the definition.`,
      ),
    );
  }

  return result({
    data: {
      airport: code,
      year: ROUTE_MIX_YEAR,
      requestedCutoffMi: cutoff,
      headline: {
        passengerOnlySharePct: requested.passengerOnly.sharePct,
        includingCargoSharePct: requested.includingCargo.sharePct,
      },
      sharesByCutoff: atCutoffs,
      departures: { passenger: passengerTotal, cargo: cargoTotal, cargoSharePct: pct(cargoShare), excludedSameAirport: (paxInvalid._sum.departures ?? 0) + (cargoInvalid._sum.departures ?? 0) },
      byYear,
      topPassengerRoutes: topPassenger,
      topCargoRoutes: topCargo,
    },
    sources: [SRC.t100],
    assumptions: [
      `Departures are T-100 DEPARTURES_PERFORMED from ${code} (origin basis) for calendar year ${ROUTE_MIX_YEAR}, weighted by departures (rows are carrier-route-month aggregates, never counted as flights).`,
      `Long-haul = route distance >= cutoff, inclusive (requested ${cutoff} mi; also reported at ${REFERENCE_CUTOFFS_MI.join(" / ")} mi because the answer depends on the threshold).`,
      "Passenger-only = scheduled and non-scheduled passenger service (T-100 classes F, L). Including cargo adds all-cargo flights (classes G, P). Belly freight on passenger flights is already inside the passenger rows.",
      "Same-airport rows (distance 0) are excluded from all long-haul shares and reported separately.",
      "Route distance is the T-100 great-circle segment distance (one number per route); a segment is not a full itinerary.",
    ],
    flags,
    methodology: [
      "Share = long-haul departures / total departures, computed by the scoring engine's longHaulShare(): " + requested.passengerOnly.explanation + " (passenger-only); " + requested.includingCargo.explanation + " (including cargo).",
    ],
  });
}
