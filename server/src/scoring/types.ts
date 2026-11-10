export type ComponentName = "utilization" | "growth" | "congestion" | "pricingPower" | "scale";
export type Weights = Record<ComponentName, number>;
export type NormalizationMethod = "minmax" | "percentile";
export type Confidence = "high" | "medium" | "low";

export interface ScoringConfig {
  weightsVersion: string;
  weights: Weights;
  growthBlend: { recovery: number; forecast: number };
  confidenceThresholds: { high: number; medium: number };
  smallPeerSet: number;
  /** How raw metrics become 0..100 scores. minmax: (x-min)/(max-min)*100 (scale uses ln(pax)); percentile: midrank percentile. */
  normalization: NormalizationMethod;
}

/** Any metric may be null/undefined (unknown). Non-finite numbers are treated as null. */
export interface AirportMetrics {
  iata: string;
  /** passengers / seats over the trailing 12 months, 0..1 */
  loadFactor12m?: number | null;
  /** trailing-12-month passengers */
  pax12m?: number | null;
  /** 2019 passengers (pre-COVID baseline) */
  paxBaseline2019?: number | null;
  /** FAA TAF forecast CAGR as a fraction (0.02 = 2%/yr) */
  forecastCagr?: number | null;
  /** share of arrivals 15+ min late, 0..1 (NAS-attributable if available) */
  delayRate?: number | null;
  /** airport avg fare / national avg fare */
  fareRatio?: number | null;
  flags?: { cargoHeavy?: boolean; [k: string]: boolean | undefined };
}

export interface ComponentScore {
  component: ComponentName;
  available: boolean;
  /** Primary raw metric (growth: recovery ratio pax12m / paxBaseline2019). */
  rawValue: number | null;
  /** All raw inputs behind this component. */
  rawValues: Record<string, number | null>;
  /** 0..100 normalized score within the peer set (min-max or percentile, see AirportScore.normalization); null if unavailable. */
  score: number | null;
  configuredWeight: number;
  /** Weight after dropping missing components and re-normalizing (0 if unavailable). */
  weight: number;
  /** score * weight; contributions sum to total. */
  contribution: number;
}

export interface AirportScore {
  iata: string;
  rank: number;
  /** 0..100, null if no component had data. */
  total: number | null;
  components: Record<ComponentName, ComponentScore>;
  flags: string[];
  confidence: Confidence;
  /** share (0..1) of configured weight backed by data */
  weightCoverage: number;
  weightsVersion: string;
  /** Which normalization produced the component scores, with a UI-ready label. */
  normalization: { method: NormalizationMethod; label: string };
}
