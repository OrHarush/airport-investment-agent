import type { ToolResult, ToolSource } from "@airport/shared";
import { defaultConfig, DEFAULT_UNMET_DEMAND_THRESHOLD } from "../scoring/index.js";
import { dedupeFlags } from "./flags.js";

/** Date the source files were retrieved/verified (docs/data-sources.md). */
export const RETRIEVED_AT = "2026-11-10";

export const SRC = {
  t100: { name: "BTS T-100 Segment (All Carriers)", url: "https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FMG", retrievedAt: RETRIEVED_AT },
  ontime: {
    name: "BTS On-Time Performance (Reporting Carrier)",
    url: "https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{YYYY}_{M}.zip",
    retrievedAt: RETRIEVED_AT,
  },
  fares: { name: "BTS Average Domestic Airline Itinerary Fares", url: "https://www.transtats.bts.gov/AverageFare/", retrievedAt: RETRIEVED_AT },
  taf: { name: "FAA Terminal Area Forecast 2025", url: "https://www.faa.gov/data_research/aviation/taf", retrievedAt: RETRIEVED_AT },
  ourairports: { name: "OurAirports", url: "https://davidmegginson.github.io/ourairports-data/airports.csv", retrievedAt: RETRIEVED_AT },
} as const satisfies Record<string, ToolSource>;

export const uniq = <T>(xs: T[]) => [...new Set(xs)];
export const round = (x: number | null, digits = 4): number | null => (x === null ? null : Number(x.toFixed(digits)));

/** Describes the scoring model from the engine's own config so the text cannot drift from the weights in use. */
export function scoringMethodology(weights = defaultConfig.weights, method = defaultConfig.normalization): string[] {
  const w = (Object.entries(weights) as [string, number][]).map(([k, v]) => `${k} ${v}`).join(", ");
  const gb = defaultConfig.growthBlend;
  return [
    method === "minmax"
      ? `Scoring model ${defaultConfig.weightsVersion}: each component is a min-max score (x - min) / (max - min) x 100 of the airport's raw metric across ALL 16 in-scope airports (50 for everyone if max = min; size uses ln(pax) first); total = sum(score x weight). Scores do not depend on which airports a question displays.`
      : `Scoring model ${defaultConfig.weightsVersion}: each component is the midrank percentile (0-100) of the airport's raw metric across ALL 16 in-scope airports; total = sum(percentile x weight).`,
    `Configured weights: ${w}. Components with no data are dropped and the remaining weights re-normalized; confidence is the share of configured weight backed by data (>=${defaultConfig.confidenceThresholds.high} high, >=${defaultConfig.confidenceThresholds.medium} medium, else low).`,
    `Component inputs: utilization = trailing-12m load factor (T-100); growth = blend (${gb.recovery}/${gb.forecast}) of recovery (trailing-12m pax / 2019 pax) and FAA TAF enplanement CAGR FY2025-FY2030; congestion = share of arriving flights with a NAS delay over the trailing 12 months (higher = more congestion = more expansion pressure); pricingPower = mean fare / 16-airport median fare over the latest 4 quarters; scale = trailing-12m passengers (ln-transformed under min-max).`,
    `Proxy, not capacity: no source has gates or terminal square footage, so the score measures demand pressure, not physical terminal need.`,
  ];
}

export const UNMET_THRESHOLD = DEFAULT_UNMET_DEMAND_THRESHOLD;

/** De-duplicate sources/assumptions/flags/methodology before returning. */
export function result<T>(r: ToolResult<T>): ToolResult<T> {
  const seen = new Set<string>();
  const sources = r.sources.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));
  return { ...r, sources, assumptions: uniq(r.assumptions), flags: dedupeFlags(r.flags), ...(r.methodology ? { methodology: uniq(r.methodology) } : {}) };
}
