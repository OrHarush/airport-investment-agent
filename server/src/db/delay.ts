import type { PrismaClient } from "@prisma/client";
import type { Window } from "./metrics.js";

export interface DirectionDelay {
  direction: "dep" | "arr";
  months: number;
  flights: number;
  flown: number;
  cancelled: number;
  cancelRate: number | null;
  /** nas_delayed_flights / flown (the congestion metric used in scoring) */
  nasDelayRate: number | null;
  /** nas_min / flown */
  nasMinPerFlown: number | null;
  /** delayed15 / flown */
  delayed15Share: number | null;
  /** Flown-weighted mean of the monthly medians. The pooled median is not recoverable from monthly aggregates. */
  medianDelayMin: number | null;
  /** Flown-weighted mean of the monthly 95th percentiles (same caveat). */
  p95DelayMin: number | null;
  medianTaxiMin: number | null;
  maxDelayMin: number | null;
}

export interface AirportDelay {
  airport: string;
  window: string;
  /** On-Time sample vs T-100 passenger departures, pooled over the scoring window */
  coverageWindowPct: number | null;
  delayScoreEligible: boolean;
  dep: DirectionDelay | null;
  arr: DirectionDelay | null;
}

/** Aggregate monthly delay_stats rows (sums of counts; ratios recomputed from the sums) over a window. */
export async function delaySummary(prisma: PrismaClient, airports: string[], w: Window): Promise<Map<string, AirportDelay>> {
  const rows = await prisma.delayStat.findMany({
    where: { airport: { in: airports }, period: { gte: w.from, lte: w.to } },
    orderBy: [{ airport: "asc" }, { period: "asc" }],
  });
  const out = new Map<string, AirportDelay>();
  for (const code of airports) {
    const mine = rows.filter((r) => r.airport === code);
    const dir = (d: "dep" | "arr"): DirectionDelay | null => {
      const r = mine.filter((x) => x.direction === d);
      if (!r.length) return null;
      const sum = (f: (x: (typeof r)[number]) => number) => r.reduce((s, x) => s + f(x), 0);
      const flown = sum((x) => x.flown);
      const flights = sum((x) => x.flights);
      const wavg = (f: (x: (typeof r)[number]) => number) => (flown > 0 ? sum((x) => f(x) * x.flown) / flown : null);
      return {
        direction: d,
        months: r.length,
        flights,
        flown,
        cancelled: sum((x) => x.cancelled),
        cancelRate: flights > 0 ? sum((x) => x.cancelled) / flights : null,
        nasDelayRate: flown > 0 ? sum((x) => x.nasDelayedFlights) / flown : null,
        nasMinPerFlown: flown > 0 ? sum((x) => x.nasMin) / flown : null,
        delayed15Share: flown > 0 ? sum((x) => x.delayed15) / flown : null,
        medianDelayMin: wavg((x) => x.medianDelayMin),
        p95DelayMin: wavg((x) => x.p95DelayMin),
        medianTaxiMin: wavg((x) => x.medianTaxiMin),
        maxDelayMin: Math.max(...r.map((x) => x.maxDelayMin)),
      };
    };
    out.set(code, {
      airport: code,
      window: w.label,
      coverageWindowPct: mine[0]?.coverageWindowPct ?? null,
      delayScoreEligible: mine.length > 0 && mine.every((x) => x.delayScoreEligible),
      dep: dir("dep"),
      arr: dir("arr"),
    });
  }
  return out;
}
