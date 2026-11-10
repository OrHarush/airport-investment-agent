import { componentNames, DEFAULT_LONG_HAUL_CUTOFF_MI, DEFAULT_UNMET_DEMAND_THRESHOLD, defaultConfig } from "./config.js";
import { normalizeWeights, scoreAirports } from "./engine.js";
import type { AirportMetrics, AirportScore, ComponentName, ScoringConfig, Weights } from "./types.js";

// ---------- unmet demand ----------

export interface UnmetDemandResult {
  seats: number;
  passengers: number;
  loadFactor: number | null;
  threshold: number;
  /** Passenger-equivalents of demand above the threshold: seats * max(0, loadFactor - threshold). */
  unmetPassengers: number;
  formula: string;
  explanation: string;
}

/**
 * Proxy for unmet demand: the demand sitting above a "comfortable" load factor.
 * unmet = seats * max(0, loadFactor - threshold), where loadFactor = passengers / seats.
 * This is a proxy (flown passengers are capped by seats), not a measured number of turned-away passengers.
 */
export function unmetDemand(input: { seats: number; passengers: number; threshold?: number }): UnmetDemandResult {
  const threshold = input.threshold ?? DEFAULT_UNMET_DEMAND_THRESHOLD;
  const { seats, passengers } = input;
  const formula = "unmetPassengers = seats * max(0, loadFactor - threshold); loadFactor = passengers / seats";
  if (!Number.isFinite(seats) || !Number.isFinite(passengers) || seats <= 0 || passengers < 0) {
    return {
      seats,
      passengers,
      loadFactor: null,
      threshold,
      unmetPassengers: 0,
      formula,
      explanation: `${formula}. Inputs invalid (seats=${seats}, passengers=${passengers}); unmet demand reported as 0.`,
    };
  }
  const loadFactor = passengers / seats;
  const unmetPassengers = seats * Math.max(0, loadFactor - threshold);
  return {
    seats,
    passengers,
    loadFactor,
    threshold,
    unmetPassengers,
    formula,
    explanation:
      `${formula}. = ${seats} * max(0, ${loadFactor.toFixed(4)} - ${threshold}) = ${unmetPassengers.toFixed(1)}. ` +
      (loadFactor > threshold ? "Load factor is above the threshold." : "Load factor is at or below the threshold, so no unmet demand is implied."),
  };
}

// ---------- long haul ----------

export interface LongHaulResult {
  cutoffMi: number;
  longHaulDepartures: number;
  totalDepartures: number;
  /** 0..1, null if there are no departures */
  share: number | null;
  explanation: string;
}

/** Share of departures flying cutoffMi or more (inclusive: distance >= cutoff counts as long-haul). */
export function longHaulShare(
  departures: { distanceMi: number; departures: number }[],
  cutoffMi: number = DEFAULT_LONG_HAUL_CUTOFF_MI,
): LongHaulResult {
  let total = 0;
  let long = 0;
  for (const d of departures) {
    if (!Number.isFinite(d.distanceMi) || !Number.isFinite(d.departures) || d.departures <= 0) continue;
    total += d.departures;
    if (d.distanceMi >= cutoffMi) long += d.departures;
  }
  const share = total > 0 ? long / total : null;
  return {
    cutoffMi,
    longHaulDepartures: long,
    totalDepartures: total,
    share,
    explanation:
      share === null
        ? `No departures supplied; share undefined (cutoff ${cutoffMi} mi).`
        : `${long} of ${total} departures fly >= ${cutoffMi} mi = ${(share * 100).toFixed(1)}%.`,
  };
}

// ---------- sensitivity ----------

export interface SensitivityScenario {
  component: ComponentName;
  direction: "+" | "-";
  weights: Weights;
  order: string[];
  top1Changed: boolean;
  top3SetChanged: boolean;
  top3OrderChanged: boolean;
  /** iata -> positions moved vs baseline (absolute) */
  rankMoves: Record<string, number>;
}

export interface SensitivityResult {
  perturbation: number;
  baselineOrder: string[];
  scenarios: SensitivityScenario[];
  summary: {
    top1Stable: boolean;
    top3SetStable: boolean;
    top3OrderStable: boolean;
    /** worst-case rank move per airport across all scenarios */
    maxRankMove: Record<string, number>;
    scenariosChangingTop1: number;
    scenariosChangingTop3Set: number;
  };
}

/** Perturb each weight by +-perturbation (default 10%, relative), renormalize, and report ranking stability. */
export function sensitivity(
  airports: AirportMetrics[],
  weights: Weights = defaultConfig.weights,
  perturbation = 0.1,
  config: ScoringConfig = defaultConfig,
): SensitivityResult {
  const base = normalizeWeights(weights);
  const baseRank = scoreAirports(airports, { weights: base, config });
  const baseOrder = baseRank.map((r) => r.iata);
  const basePos = new Map(baseOrder.map((c, i) => [c, i]));
  const top3 = (o: string[]) => o.slice(0, 3);

  const scenarios: SensitivityScenario[] = [];
  for (const component of componentNames) {
    for (const direction of ["+", "-"] as const) {
      const w = { ...base };
      w[component] = base[component] * (direction === "+" ? 1 + perturbation : 1 - perturbation);
      const nw = normalizeWeights(w);
      const order = scoreAirports(airports, { weights: nw, config }).map((r) => r.iata);
      const rankMoves: Record<string, number> = {};
      order.forEach((c, i) => (rankMoves[c] = Math.abs(i - (basePos.get(c) as number))));
      const b3 = top3(baseOrder);
      const s3 = top3(order);
      scenarios.push({
        component,
        direction,
        weights: nw,
        order,
        top1Changed: order[0] !== baseOrder[0],
        top3SetChanged: [...b3].sort().join() !== [...s3].sort().join(),
        top3OrderChanged: b3.join() !== s3.join(),
        rankMoves,
      });
    }
  }

  const maxRankMove: Record<string, number> = {};
  for (const c of baseOrder) maxRankMove[c] = Math.max(0, ...scenarios.map((s) => s.rankMoves[c] ?? 0));
  return {
    perturbation,
    baselineOrder: baseOrder,
    scenarios,
    summary: {
      top1Stable: scenarios.every((s) => !s.top1Changed),
      top3SetStable: scenarios.every((s) => !s.top3SetChanged),
      top3OrderStable: scenarios.every((s) => !s.top3OrderChanged),
      maxRankMove,
      scenariosChangingTop1: scenarios.filter((s) => s.top1Changed).length,
      scenariosChangingTop3Set: scenarios.filter((s) => s.top3SetChanged).length,
    },
  };
}

// ---------- compare ----------

export interface ComponentDiff {
  component: ComponentName;
  /** a - b; null if either side lacks the component */
  scoreDiff: number | null;
  contributionDiff: number;
  rawDiff: number | null;
  a: { rawValue: number | null; score: number | null; contribution: number };
  b: { rawValue: number | null; score: number | null; contribution: number };
  leader: "a" | "b" | "tie" | "n/a";
}

export interface CompareResult {
  a: string;
  b: string;
  totalDiff: number | null;
  rankDiff: number;
  components: ComponentDiff[];
  /** component with the largest absolute contribution difference */
  biggestDriver: ComponentName | null;
}

/** Per-component differences (a minus b). Both must come from the same scoring run for percentiles to be comparable. */
export function compare(a: AirportScore, b: AirportScore): CompareResult {
  const components = componentNames.map((c): ComponentDiff => {
    const x = a.components[c];
    const y = b.components[c];
    const both = x.score !== null && y.score !== null;
    const pd = both ? (x.score as number) - (y.score as number) : null;
    return {
      component: c,
      scoreDiff: pd,
      contributionDiff: x.contribution - y.contribution,
      rawDiff: x.rawValue !== null && y.rawValue !== null ? x.rawValue - y.rawValue : null,
      a: { rawValue: x.rawValue, score: x.score, contribution: x.contribution },
      b: { rawValue: y.rawValue, score: y.score, contribution: y.contribution },
      leader: pd === null ? "n/a" : pd > 0 ? "a" : pd < 0 ? "b" : "tie",
    };
  });
  let driver: ComponentName | null = null;
  let best = 0;
  for (const d of components) {
    const m = Math.abs(d.contributionDiff);
    if (m > best) {
      best = m;
      driver = d.component;
    }
  }
  return {
    a: a.iata,
    b: b.iata,
    totalDiff: a.total !== null && b.total !== null ? a.total - b.total : null,
    rankDiff: a.rank - b.rank,
    components,
    biggestDriver: driver,
  };
}
