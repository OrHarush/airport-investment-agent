import type { PrismaClient } from "@prisma/client";
import { unmetDemand } from "../scoring/index.js";
import type { Window } from "./metrics.js";

/** Route-months with fewer departures than this are ignored (tiny air-taxi route-months can show LF > 1). */
export const MIN_ROUTE_MONTH_DEPARTURES = 10;

export interface RouteMonthCell {
  origin: string;
  dest: string;
  period: string;
  seats: number;
  passengers: number;
  departures: number;
  loadFactor: number | null;
  /** seats * max(0, LF - 0.85) for this route-month (scoring engine unmetDemand) */
  unmetSeats: number;
}

/** Route-month grain: seats and passengers per (origin, dest, month) aggregated across carriers, then the engine's unmetDemand(). */
export async function routeMonthCells(prisma: PrismaClient, origins: string[], w: Window): Promise<RouteMonthCell[]> {
  const rows = await prisma.routeStat.groupBy({
    by: ["origin", "dest", "period"],
    where: { origin: { in: origins }, period: { gte: w.from, lte: w.to }, lfEligible: true },
    _sum: { seats: true, passengers: true, departures: true },
  });
  return rows
    .map((r) => ({ origin: r.origin, dest: r.dest, period: r.period, seats: r._sum.seats ?? 0, passengers: r._sum.passengers ?? 0, departures: r._sum.departures ?? 0 }))
    .filter((c) => c.departures >= MIN_ROUTE_MONTH_DEPARTURES && c.seats > 0)
    .map((c) => {
      const u = unmetDemand({ seats: c.seats, passengers: c.passengers });
      return { ...c, loadFactor: u.loadFactor, unmetSeats: u.unmetPassengers };
    });
}

export function unmetSeatsByAirport(cells: RouteMonthCell[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cells) m.set(c.origin, (m.get(c.origin) ?? 0) + c.unmetSeats);
  return m;
}
