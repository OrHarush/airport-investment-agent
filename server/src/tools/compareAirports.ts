import type { ToolResult } from "@airport/shared";
import { prisma } from "../db.js";
import { delaySummary } from "../db/delay.js";
import { loadMetrics } from "../db/metrics.js";
import { compare, defaultConfig, scoreAirports } from "../scoring/index.js";
import { airportFlags } from "./rankAirports.js";
import { result, round, scoringMethodology, SRC } from "./common.js";

const pct = (x: number | null) => (x === null ? null : round(x * 100, 2));

export async function compareAirports(input: { a: string; b: string }): Promise<ToolResult> {
  const a = input.a.toUpperCase();
  const b = input.b.toUpperCase();
  if (a === b) throw new Error("Pick two different airports to compare.");

  // Scores are only comparable inside one scoring run: score the full 16-airport peer set, then compare.
  const loaded = await loadMetrics(prisma);
  const scores = scoreAirports(loaded.metrics);
  const sa = scores.find((s) => s.iata === a);
  const sb = scores.find((s) => s.iata === b);
  if (!sa || !sb) throw new Error(`Unknown airport(s): ${[!sa && a, !sb && b].filter(Boolean).join(", ")}`);
  const diff = compare(sa, sb);

  const [delays, airports, metricRows] = await Promise.all([
    delaySummary(prisma, [a, b], loaded.window),
    prisma.airport.findMany({ where: { airport: { in: [a, b] } } }),
    prisma.airportMetric.findMany({ where: { airport: { in: [a, b] } } }),
  ]);

  const side = (code: string, s: typeof sa) => {
    const ap = airports.find((x) => x.airport === code)!;
    const m = metricRows.find((x) => x.airport === code)!;
    const d = delays.get(code)!;
    const fmt = (x: NonNullable<typeof d.dep> | null) =>
      x && {
        flightsInSample: x.flights,
        flown: x.flown,
        cancelledPct: pct(x.cancelRate),
        nasDelayRatePct: pct(x.nasDelayRate),
        delayed15Pct: pct(x.delayed15Share),
        nasMinutesPerFlight: round(x.nasMinPerFlown, 3),
        medianDelayMin: round(x.medianDelayMin, 2),
        p95DelayMin: round(x.p95DelayMin, 2),
        medianTaxiMin: round(x.medianTaxiMin, 2),
        maxDelayMin: x.maxDelayMin,
      };
    return {
      airport: code,
      name: ap.name,
      rank: s.rank,
      total: round(s.total, 2),
      confidence: s.confidence,
      congestionScore: round(s.components.congestion.score, 2),
      flags: airportFlags(s, loaded),
      scale: {
        t100DeparturesLast12m: m.departuresLast12m,
        paxLast12m: m.paxLast12m,
        openRunways: ap.openRunways,
        longestOpenRunwayFt: ap.longestOpenRunwayFt,
        t100DeparturesPerOpenRunway: round(m.departuresLast12m / Math.max(1, ap.openRunways), 0),
      },
      delay: {
        window: d.window,
        coverageOfT100DeparturesPct: round(d.coverageWindowPct, 1),
        eligibleForScoring: d.delayScoreEligible,
        departures: fmt(d.dep),
        arrivals: fmt(d.arr),
      },
    };
  };

  const A = side(a, sa);
  const B = side(b, sb);
  const flags = [...loaded.globalFlags, ...A.flags, ...B.flags];

  return result({
    data: {
      a: A,
      b: B,
      scoreComparison: {
        peerSet: "all 16 in-scope airports",
        totalDiff: round(diff.totalDiff, 2),
        rankDiff: diff.rankDiff,
        biggestDriver: diff.biggestDriver,
        components: diff.components.map((c) => ({
          component: c.component,
          leader: c.leader === "a" ? a : c.leader === "b" ? b : c.leader,
          scoreDiff: round(c.scoreDiff, 2),
          contributionDiff: round(c.contributionDiff, 3),
          rawDiff: round(c.rawDiff, 5),
          [a]: { rawValue: c.a.rawValue, score: round(c.a.score, 2), contribution: round(c.a.contribution, 3) },
          [b]: { rawValue: c.b.rawValue, score: round(c.b.score, 2), contribution: round(c.b.contribution, 3) },
        })),
      },
    },
    sources: [SRC.ontime, SRC.t100, SRC.ourairports, SRC.fares, SRC.taf],
    assumptions: [
      `Delay figures cover ${loaded.window.label} from the On-Time file (reporting carriers only). Departure side = flights leaving the airport; arrival side = flights arriving.`,
      "NAS delay rate = flights with a NAS-attributed delay / flights flown. Delay causes are attached to a flight's arrival delay, so NAS delay on the departure side is not strictly caused by the origin airport; compare arrivals and departures together.",
      "Median and p95 delay are the flown-weighted mean of monthly medians/p95s: the exact pooled median/p95 cannot be recovered from monthly aggregates.",
      "On-Time under-samples airports with many non-reporting carriers (see coverage); rates describe the reporting carriers, not every flight.",
      "Raw congestion rates ignore physical scale; departures per open runway uses T-100 passenger departures and counts every open runway equally (no parallel/crossing runway or noise-curfew adjustment).",
      "Score components are normalized scores against all 16 airports, higher congestion = higher expansion pressure; this is not a statement about which airport is 'better'.",
    ],
    flags,
    methodology: [...scoringMethodology(defaultConfig.weights)],
  });
}
