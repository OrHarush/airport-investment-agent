import { componentNames, defaultConfig } from "./config.js";
import type {
  AirportMetrics,
  AirportScore,
  ComponentName,
  ComponentScore,
  Confidence,
  NormalizationMethod,
  ScoringConfig,
  Weights,
} from "./types.js";

const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (x: number) => Number(x.toFixed(9));

/**
 * Midrank percentile (0..100) within the non-null values: ties share the average rank.
 * n=1 -> 50 (no information). Nulls stay null.
 */
export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null);
  const n = present.length;
  return values.map((v) => {
    if (v === null) return null;
    if (n === 1) return 50;
    let less = 0;
    let equal = 0;
    for (const p of present) {
      if (p < v) less++;
      else if (p === v) equal++;
    }
    // 0-based midrank = less + (equal - 1) / 2
    return round((100 * (less + (equal - 1) / 2)) / (n - 1));
  });
}

/**
 * Min-max scaling to 0..100 over the non-null values: (x - min) / (max - min) * 100.
 * If max == min (including a single value) everyone gets 50. Nulls stay null.
 */
export function minMaxScores(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null);
  if (!present.length) return values.map(() => null);
  const min = Math.min(...present);
  const max = Math.max(...present);
  return values.map((v) => (v === null ? null : max === min ? 50 : round(((v - min) / (max - min)) * 100)));
}

/** Human label for the UI, so nothing downstream hard-codes the method. */
export function normalizationInfo(method: NormalizationMethod, peerCount: number): { method: NormalizationMethod; label: string } {
  return {
    method,
    label: method === "minmax" ? `Min-max score vs all ${peerCount} airports` : `Percentile rank vs all ${peerCount} airports`,
  };
}

export function normalizeWeights(w: Weights): Weights {
  const sum = componentNames.reduce((s, c) => s + Math.max(0, w[c]), 0);
  if (!(sum > 0)) throw new Error("Weights must have a positive sum");
  const out = {} as Weights;
  for (const c of componentNames) out[c] = Math.max(0, w[c]) / sum;
  return out;
}

export interface ScoreOptions {
  weights?: Weights;
  config?: ScoringConfig;
}

function confidenceFor(coverage: number, cfg: ScoringConfig): Confidence {
  // epsilon so e.g. 0.9 (= 1 - 0.1) is not lost to float error
  if (coverage >= cfg.confidenceThresholds.high - 1e-9) return "high";
  if (coverage >= cfg.confidenceThresholds.medium - 1e-9) return "medium";
  return "low";
}

/** Score and rank a peer set. Deterministic: same input -> same output, no I/O. */
export function scoreAirports(airports: AirportMetrics[], opts: ScoreOptions = {}): AirportScore[] {
  const cfg = opts.config ?? defaultConfig;
  const configured = normalizeWeights(opts.weights ?? cfg.weights);
  const codes = new Set<string>();
  for (const a of airports) {
    const k = a.iata.toUpperCase();
    if (codes.has(k)) throw new Error(`Duplicate airport in peer set: ${k}`);
    codes.add(k);
  }

  const raw = airports.map((a) => {
    const pax = num(a.pax12m);
    const base = num(a.paxBaseline2019);
    return {
      loadFactor: num(a.loadFactor12m),
      pax,
      recovery: pax !== null && base !== null && base > 0 ? pax / base : null,
      forecast: num(a.forecastCagr),
      delay: num(a.delayRate),
      fare: num(a.fareRatio),
    };
  });

  const method = cfg.normalization;
  const norm = method === "minmax" ? minMaxScores : percentileRanks;
  const pLoad = norm(raw.map((r) => r.loadFactor));
  const pRec = norm(raw.map((r) => r.recovery));
  const pFc = norm(raw.map((r) => r.forecast));
  const pDelay = norm(raw.map((r) => r.delay));
  const pFare = norm(raw.map((r) => r.fare));
  // Size: min-max uses ln(pax) so one giant airport does not flatten everyone else (percentile is rank-only, log is a no-op).
  const logPax = raw.map((r) => (r.pax !== null && r.pax > 0 ? Math.log(r.pax) : null));
  const pScale = method === "minmax" ? minMaxScores(logPax) : percentileRanks(raw.map((r) => r.pax));

  const gb = cfg.growthBlend;
  const gSum = gb.recovery + gb.forecast;

  const unscored = airports.map((a, i) => {
    const r = raw[i];
    const flags: string[] = [];

    // growth: blend of the available sub-percentiles; the available fraction feeds confidence
    let growthPct: number | null = null;
    let growthAvail = 0;
    const rec = pRec[i];
    const fc = pFc[i];
    if (rec !== null && fc !== null) {
      growthPct = round((gb.recovery * rec + gb.forecast * fc) / gSum);
      growthAvail = 1;
    } else if (rec !== null) {
      growthPct = rec;
      growthAvail = gb.recovery / gSum;
      flags.push("PARTIAL_GROWTH: forecastCagr missing, growth uses recovery vs 2019 only");
    } else if (fc !== null) {
      growthPct = fc;
      growthAvail = gb.forecast / gSum;
      flags.push("PARTIAL_GROWTH: recovery vs 2019 missing (pax12m or paxBaseline2019), growth uses forecastCagr only");
    }

    const single = (p: number | null) => ({ pct: p, avail: p === null ? 0 : 1 });
    const parts: Record<ComponentName, { pct: number | null; avail: number; rawValue: number | null; rawValues: Record<string, number | null> }> = {
      utilization: { ...single(pLoad[i]), rawValue: r.loadFactor, rawValues: { loadFactor12m: r.loadFactor } },
      growth: { pct: growthPct, avail: growthAvail, rawValue: r.recovery, rawValues: { recoveryRatio: r.recovery, forecastCagr: r.forecast } },
      congestion: { ...single(pDelay[i]), rawValue: r.delay, rawValues: { delayRate: r.delay } },
      pricingPower: { ...single(pFare[i]), rawValue: r.fare, rawValues: { fareRatio: r.fare } },
      scale: { ...single(pScale[i]), rawValue: r.pax, rawValues: { pax12m: r.pax, ...(method === "minmax" ? { lnPax12m: logPax[i] } : {}) } },
    };

    const missing = componentNames.filter((c) => parts[c].pct === null);
    if (missing.length) flags.push(`MISSING_COMPONENTS: ${missing.join(", ")} (dropped, remaining weights re-normalized)`);
    if (a.flags?.cargoHeavy) {
      flags.push("CARGO_HEAVY: passenger-based metrics understate this airport's role; freight is not scored");
    }
    if (airports.length === 1) flags.push("SINGLE_AIRPORT_PEER_SET: scores are not meaningful (set to 50)");
    else if (airports.length < cfg.smallPeerSet) flags.push(`SMALL_PEER_SET: only ${airports.length} airports, scores are coarse`);

    const availableWeight = componentNames.reduce((s, c) => s + (parts[c].pct === null ? 0 : configured[c]), 0);
    const coverage = componentNames.reduce((s, c) => s + configured[c] * parts[c].avail, 0);

    const components = {} as Record<ComponentName, ComponentScore>;
    for (const c of componentNames) {
      const p = parts[c];
      const available = p.pct !== null && availableWeight > 0;
      const weight = available ? configured[c] / availableWeight : 0;
      components[c] = {
        component: c,
        available,
        rawValue: p.rawValue,
        rawValues: p.rawValues,
        score: p.pct,
        configuredWeight: configured[c],
        weight: round(weight),
        contribution: available ? round((p.pct as number) * weight) : 0,
      };
    }
    let total: number | null = null;
    if (availableWeight > 0) total = round(componentNames.reduce((s, c) => s + components[c].contribution, 0));
    else flags.push("NO_DATA: no component had data, airport cannot be scored");

    return {
      iata: a.iata.toUpperCase(),
      total,
      components,
      flags,
      confidence: availableWeight > 0 ? confidenceFor(coverage, cfg) : ("low" as Confidence),
      weightCoverage: round(coverage),
      weightsVersion: cfg.weightsVersion,
      normalization: normalizationInfo(method, airports.length),
      pax: r.pax,
    };
  });

  // Deterministic order: total desc (nulls last), then pax12m desc (nulls last), then IATA asc.
  const sorted = [...unscored].sort((x, y) => {
    if (x.total !== y.total) {
      if (x.total === null) return 1;
      if (y.total === null) return -1;
      return y.total - x.total;
    }
    if (x.pax !== y.pax) {
      if (x.pax === null) return 1;
      if (y.pax === null) return -1;
      return y.pax - x.pax;
    }
    return x.iata < y.iata ? -1 : x.iata > y.iata ? 1 : 0;
  });

  return sorted.map(({ pax: _pax, ...s }, idx) => ({ rank: idx + 1, ...s }));
}
