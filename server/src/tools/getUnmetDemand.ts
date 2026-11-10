import type { ToolFlag, ToolResult } from "@airport/shared";
import { prisma } from "../db.js";
import { delaySummary } from "../db/delay.js";
import { loadMetrics } from "../db/metrics.js";
import { unmetDemand } from "../scoring/index.js";
import { result, round, SRC, UNMET_THRESHOLD } from "./common.js";

/** Routes/carriers with fewer departures than this in the window are ignored (a 2-seat air-taxi route at 100% LF is not demand evidence). */
export const MIN_DEPARTURES = 100;
/** Route-months with fewer departures than this are ignored (tiny air-taxi route-months can show LF > 1). */
export const MIN_ROUTE_MONTH_DEPARTURES = 10;

const pct = (x: number | null) => (x === null ? null : round(x * 100, 2));

interface Agg {
  seats: number;
  passengers: number;
  departures: number;
}

function unmetRow(a: Agg) {
  const u = unmetDemand({ seats: a.seats, passengers: a.passengers });
  return {
    departures: a.departures,
    seats: a.seats,
    passengers: a.passengers,
    loadFactor: round(u.loadFactor, 4),
    unmetPassengers: round(u.unmetPassengers, 0),
  };
}

export async function getUnmetDemand(input: { airport: string; topN?: number }): Promise<ToolResult> {
  const code = input.airport.toUpperCase();
  const topN = input.topN ?? 10;
  const loaded = await loadMetrics(prisma);
  const w = loaded.window;
  const ap = await prisma.airport.findUnique({ where: { airport: code } });
  const m = await prisma.airportMetric.findUnique({ where: { airport: code } });
  if (!ap || !m) throw new Error(`Unknown airport "${code}". In-scope airports: ${loaded.metrics.map((x) => x.iata).join(", ")}.`);

  const where = { origin: code, period: { gte: w.from, lte: w.to }, lfEligible: true };
  const [routeMonths, byRoute, byCarrier, byMonth, fares, delays, peers, allMetrics] = await Promise.all([
    prisma.routeStat.groupBy({ by: ["dest", "period"], where, _sum: { seats: true, passengers: true, departures: true } }),
    prisma.routeStat.groupBy({ by: ["dest", "distance"], where, _sum: { seats: true, passengers: true, departures: true } }),
    prisma.routeStat.groupBy({ by: ["carrier", "carrierName"], where, _sum: { seats: true, passengers: true, departures: true } }),
    prisma.routeStat.groupBy({ by: ["period"], where, _sum: { seats: true, passengers: true, departures: true }, orderBy: { period: "asc" } }),
    prisma.fare.findMany({ where: { airport: code }, orderBy: [{ year: "asc" }, { quarter: "asc" }] }),
    delaySummary(prisma, [code], w),
    prisma.airport.findMany({ where: { regionGroup: ap.regionGroup, NOT: { airport: code } }, select: { airport: true } }),
    prisma.airportMetric.findMany(),
  ]);

  const agg = (r: { _sum: { seats: number | null; passengers: number | null; departures: number | null } }): Agg => ({
    seats: r._sum.seats ?? 0,
    passengers: r._sum.passengers ?? 0,
    departures: r._sum.departures ?? 0,
  });

  // Airport level (the engine's unmetDemand over the whole window).
  const total = byMonth.map(agg).reduce((s, x) => ({ seats: s.seats + x.seats, passengers: s.passengers + x.passengers, departures: s.departures + x.departures }), { seats: 0, passengers: 0, departures: 0 });
  const airportLevel = unmetDemand({ seats: total.seats, passengers: total.passengers });

  // Month level: peak-season pressure that the annual average hides.
  const monthly = byMonth.map((r) => {
    const a = agg(r);
    const u = unmetDemand({ seats: a.seats, passengers: a.passengers });
    return { period: r.period, loadFactor: round(u.loadFactor, 4), unmetPassengers: round(u.unmetPassengers, 0), aboveThreshold: (u.loadFactor ?? 0) > UNMET_THRESHOLD };
  });
  const monthlyUnmetSum = monthly.reduce((s, x) => s + (x.unmetPassengers ?? 0), 0);

  // Headline: route-month grain. Seats/pax per (dest, month) are aggregated across carriers, then unmetDemand() per cell.
  const cells = routeMonths
    .map((r) => ({ dest: r.dest, period: r.period, ...agg(r) }))
    .filter((c) => c.departures >= MIN_ROUTE_MONTH_DEPARTURES && c.seats > 0)
    .map((c) => ({ ...c, u: unmetDemand({ seats: c.seats, passengers: c.passengers }) }));
  const rmUnmet = cells.reduce((s, c) => s + c.u.unmetPassengers, 0);
  const cellsAbove = cells.filter((c) => c.u.unmetPassengers > 0);
  const routeAgg = new Map<string, { dest: string; unmet: number; monthsAbove: number; seatsAbove: number; worst: { period: string; loadFactor: number } | null }>();
  for (const c of cellsAbove) {
    const cur = routeAgg.get(c.dest) ?? { dest: c.dest, unmet: 0, monthsAbove: 0, seatsAbove: 0, worst: null };
    cur.unmet += c.u.unmetPassengers; cur.monthsAbove += 1; cur.seatsAbove += c.seats;
    if (!cur.worst || (c.u.loadFactor ?? 0) > cur.worst.loadFactor) cur.worst = { period: c.period, loadFactor: c.u.loadFactor ?? 0 };
    routeAgg.set(c.dest, cur);
  }
  const distBy = new Map(byRoute.map((r) => [r.dest, r.distance]));
  const topRouteMonth = [...routeAgg.values()]
    .sort((x, y) => y.unmet - x.unmet || (x.dest < y.dest ? -1 : 1))
    .map((r) => ({ dest: r.dest, distanceMi: distBy.get(r.dest) ?? null, unmetSeats: round(r.unmet, 0), monthsAboveThreshold: r.monthsAbove, seatsInThoseMonths: r.seatsAbove, peakMonth: r.worst && { period: r.worst.period, loadFactor: round(r.worst.loadFactor, 4) } }));
  const peakMonths = [...new Set(cells.map((c) => c.period))].sort().map((p) => {
    const mine = cells.filter((c) => c.period === p);
    const above = mine.filter((c) => c.u.unmetPassengers > 0);
    return { period: p, unmetSeats: round(mine.reduce((s, c) => s + c.u.unmetPassengers, 0), 0), routesAboveThreshold: above.length, routesInMonth: mine.length, topRoute: above.sort((x, y) => y.u.unmetPassengers - x.u.unmetPassengers)[0]?.dest ?? null };
  });
  const peakMonthsRanked = [...peakMonths].sort((x, y) => (y.unmetSeats ?? 0) - (x.unmetSeats ?? 0) || (x.period < y.period ? -1 : 1));

  const qualifies = (a: Agg) => a.departures >= MIN_DEPARTURES && a.seats > 0 && a.passengers / a.seats >= UNMET_THRESHOLD;
  const rank = <T extends { unmetPassengers: number | null; id: string }>(xs: T[]) =>
    xs.sort((x, y) => (y.unmetPassengers ?? 0) - (x.unmetPassengers ?? 0) || (x.id < y.id ? -1 : 1));

  const routeAll = [...byRoute.reduce((mp, r) => {
    const a = agg(r);
    const cur = mp.get(r.dest) ?? { dest: r.dest, distanceMi: r.distance, seats: 0, passengers: 0, departures: 0 };
    cur.seats += a.seats; cur.passengers += a.passengers; cur.departures += a.departures;
    return mp.set(r.dest, cur);
  }, new Map<string, { dest: string; distanceMi: number; seats: number; passengers: number; departures: number }>()).values()];
  const hotRoutes = rank(routeAll.filter(qualifies).map((r) => ({ id: r.dest, dest: r.dest, distanceMi: r.distanceMi, ...unmetRow(r) })));
  const hotCarriers = rank(byCarrier.filter((r) => qualifies(agg(r))).map((r) => ({ id: r.carrier, carrier: r.carrier, carrierName: r.carrierName, ...unmetRow(agg(r)) })));

  // Supporting evidence (airport-level only: fares and delays have no route or carrier split in the sources).
  const last4 = fares.slice(-4);
  const prior4 = fares.slice(-8, -4);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const fareNow = mean(last4.map((f) => f.fareVsBenchmark));
  const farePrior = mean(prior4.map((f) => f.fareVsBenchmark));
  const d = delays.get(code)!;
  const myDelay = loaded.inputs.get(code)!.delay.nasDelayShareArr;
  const eligibleRates = loaded.metrics.map((x) => x.delayRate).filter((x): x is number => typeof x === "number");
  const delayRank = myDelay === null ? null : eligibleRates.filter((x) => x > myDelay).length + 1;

  const peerCodes = peers.map((p) => p.airport);
  const peerMetrics = allMetrics
    .filter((x) => peerCodes.includes(x.airport))
    .map((x) => ({ airport: x.airport, paxLast12m: x.paxLast12m, pax2019: x.pax2019, paxVs2019Pct: round((x.paxLast12m / x.pax2019 - 1) * 100, 2), loadFactorLast12m: round(x.loadFactorLast12m, 4) }))
    .sort((x, y) => (x.airport < y.airport ? -1 : 1));
  const paxVs2019 = (m.paxLast12m / m.pax2019 - 1) * 100;

  const monthsAbove = monthly.filter((x) => x.aboveThreshold).length;
  const signals = [
    { signal: "annualLoadFactorAboveThreshold", value: round(airportLevel.loadFactor, 4), threshold: UNMET_THRESHOLD, supportsConstrainedSupply: (airportLevel.loadFactor ?? 0) > UNMET_THRESHOLD },
    { signal: "monthsAboveThreshold", value: `${monthsAbove} of ${monthly.length}`, supportsConstrainedSupply: monthsAbove > 0 },
    { signal: "farePremiumVsPeerMedian", value: round(fareNow, 4), supportsConstrainedSupply: fareNow !== null && fareNow >= 1.1 },
    { signal: "fareRisingVsPrior4q", value: fareNow !== null && farePrior !== null ? round(fareNow - farePrior, 4) : null, supportsConstrainedSupply: fareNow !== null && farePrior !== null && fareNow > farePrior },
    { signal: "trafficVs2019Pct", value: round(paxVs2019, 2), supportsConstrainedSupply: paxVs2019 < 0, reading: paxVs2019 < 0 ? "traffic is still below 2019: consistent with capacity not fully restored, but also with weaker demand" : "traffic is above 2019" },
    { signal: "arrivalNasDelayRateRankAmongEligible", value: delayRank === null ? null : `${delayRank} of ${eligibleRates.length} (1 = most NAS delay)`, supportsConstrainedSupply: delayRank !== null && delayRank <= Math.ceil(eligibleRates.length / 3) },
  ];

  const flags: ToolFlag[] = [
    ...loaded.globalFlags,
    ...(loaded.airportNotes.get(code) ?? []),
    {
      code: "INFERENCE",
      severity: "warn",
      message: "Unmet demand is inferred, not measured",
      detail: "Unmet demand is a load-factor proxy; the sources have no O&D or booking data and no slot/gate/airline-schedule information, so the 'why' cannot be measured, only inferred from correlated signals.",
    },
  ];

  return result({
    data: {
      airport: code,
      window: w.label,
      threshold: UNMET_THRESHOLD,
      minDeparturesPerRowGroup: MIN_DEPARTURES,
      headline: {
        grain: "route-month (seats and passengers aggregated across carriers per destination per month)",
        unmetSeats: round(rmUnmet, 0),
        formula: "sum over route-months of seats * max(0, loadFactor - 0.85)",
        routeMonthsEvaluated: cells.length,
        routeMonthsAboveThreshold: cellsAbove.length,
        shareOfWindowSeatsOnRouteMonthsAbove: round(cellsAbove.reduce((s, c) => s + c.seats, 0) / (cells.reduce((s, c) => s + c.seats, 0) || 1), 4),
      },
      topRoutesByUnmetSeats: topRouteMonth.slice(0, topN),
      routesWithUnmetCount: topRouteMonth.length,
      peakMonths: peakMonthsRanked.slice(0, 3),
      unmetByMonth: peakMonths,
      airportLevel: {
        note: "SECONDARY: annual airport-level figure; averaging over routes and months hides peaks, so it understates the headline",
        seats: airportLevel.seats,
        passengers: airportLevel.passengers,
        loadFactor: round(airportLevel.loadFactor, 4),
        unmetPassengers: round(airportLevel.unmetPassengers, 0),
        explanation: airportLevel.explanation,
        formula: airportLevel.formula,
        loadFactorFromMetricsCsv: round(m.loadFactorLast12m, 4),
      },
      monthlyAirportLevel: monthly,
      monthlySumUnmetPassengers: round(monthlyUnmetSum, 0),
      monthlyNote: "Sum of month-by-month unmet-demand proxies. The annual figure averages peaks away; this one keeps them.",
      routesAtOrAboveThresholdWholeWindow: { count: hotRoutes.length, top: hotRoutes.slice(0, topN).map(({ id: _i, ...r }) => r) },
      carriersAtOrAboveThreshold: { count: hotCarriers.length, top: hotCarriers.slice(0, topN).map(({ id: _i, ...r }) => r) },
      supportingEvidence: {
        scope: "airport-level (sources have no route- or carrier-level fares or delays)",
        fares: {
          meanVsPeerMedianLast4q: round(fareNow, 4),
          meanVsPeerMedianPrior4q: round(farePrior, 4),
          quarters: last4.map((f) => ({ period: f.period, avgFareUsd: round(f.avgFareUsd, 2), vsPeerMedian: round(f.fareVsBenchmark, 4) })),
        },
        delay: {
          window: d.window,
          coverageOfT100DeparturesPct: round(d.coverageWindowPct, 1),
          arrivalNasDelayRatePct: d.arr?.nasDelayRate == null ? null : pct(d.arr.nasDelayRate),
          arrivalDelayed15Pct: pct(d.arr?.delayed15Share ?? null),
          departureDelayed15Pct: pct(d.dep?.delayed15Share ?? null),
          cancelRatePct: pct(d.arr?.cancelRate ?? null),
        },
        trend: {
          loadFactor: { last12m: round(m.loadFactorLast12m, 4), prior12m: round(m.loadFactorPrior12m, 4), y2019: round(m.loadFactor2019, 4) },
          paxLast12m: m.paxLast12m,
          pax2019: m.pax2019,
          growthLast12mVsPrior12mPct: round(m.growthLast12mVsPrior12mPct, 2),
        },
        regionPeers: peerMetrics,
      },
      signals,
    },
    sources: [SRC.t100, SRC.fares, SRC.ontime, SRC.taf, SRC.ourairports],
    assumptions: [
      "HEADLINE GRAIN: unmet demand is computed per route-month (seats and passengers aggregated across carriers for each destination and month) and summed, because capacity binds at peaks, not at annual averages: a route at 0.95 in August and 0.70 in February looks unconstrained on an annual average, and so does an airport whose strong routes are diluted by weak ones. The annual airport-level figure is kept as a secondary, lower-bound value.",
      `Route-months with fewer than ${MIN_ROUTE_MONTH_DEPARTURES} departures are ignored.`,
      "INFERRED, NOT MEASURED: unmet demand is a proxy for demand sitting above a 0.85 load factor (seats x max(0, LF - 0.85)); true unmet demand needs booking/O&D data that is not in scope. The 'why' (capacity cuts, slot limits, airline strategy) is likewise inferred from correlated signals, not observed.",
      `High-load routes/carriers are origin-basis T-100 passenger rows with seats > 0 and departures > 0 in ${w.label}, aggregated over the window; entries with fewer than ${MIN_DEPARTURES} departures are ignored. Routes aggregate all carriers; carriers aggregate all routes.`,
      "Fare and delay evidence is airport-level: fares are the origin-airport average domestic fare vs the median of the 16 in-scope airports (California-heavy), delays are from reporting carriers only. They cannot be attributed to individual routes or carriers.",
      "A high load factor can mean efficient capacity management rather than turned-away demand; a fare premium can reflect thin competition rather than scarcity.",
      "Seats are available seats (they lag airline schedule changes); DEPARTURES_SCHEDULED is not used so cancelled capacity is not measurable here.",
    ],
    flags,
    methodology: ["Headline: sum over route-months of unmetDemand({seats, passengers}).unmetPassengers (seats * max(0, LF - 0.85)), LF = passengers / seats per route-month.", `Secondary annual airport-level: ${airportLevel.explanation}`, `Month level applies the same formula to each month of ${w.label}.`],
  });
}
