import type { ComponentName, ScoringConfig } from "./types.js";

export const componentNames = ["utilization", "growth", "congestion", "pricingPower", "scale"] as const satisfies readonly ComponentName[];

/** Default model configuration. Bump `weightsVersion` whenever anything below changes. */
export const defaultConfig: ScoringConfig = {
  weightsVersion: "v1",
  weights: {
    utilization: 0.3,
    growth: 0.25,
    congestion: 0.2,
    pricingPower: 0.15,
    scale: 0.1,
  },
  /** Growth = blend of two percentile ranks (recovery vs 2019, FAA TAF forecast CAGR). Normalized at use. */
  growthBlend: { recovery: 0.5, forecast: 0.5 },
  /** Confidence by share of configured weight that has data: >= high -> "high", >= medium -> "medium", else "low". */
  confidenceThresholds: { high: 0.9, medium: 0.7 },
  /** Peer sets smaller than this get a SMALL_PEER_SET flag (percentiles are less meaningful). */
  smallPeerSet: 5,
  /** Min-max keeps small raw gaps small (percentile rank turns 0.813 vs 0.818 into 40 vs 100). */
  normalization: "minmax",
};

export const DEFAULT_UNMET_DEMAND_THRESHOLD = 0.85;
export const DEFAULT_LONG_HAUL_CUTOFF_MI = 3000;
