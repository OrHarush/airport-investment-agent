import { z } from "zod";

export interface ToolSource {
  name: string;
  url: string;
  retrievedAt: string;
}

export type FlagSeverity = "info" | "warn" | "high";

/** Structured flag. message: short and human (about 10 words); detail: the technical text (dataset, exact %, thresholds). */
export interface ToolFlag {
  /** Stable machine code, e.g. PARTIAL_2026, DELAY_COVERAGE, CARGO_HEAVY. Unique per (airport, code) within a result. */
  code: string;
  severity: FlagSeverity;
  message: string;
  detail?: string;
  /** IATA code when the flag is about one airport; omitted for dataset-wide flags. */
  airport?: string;
}

export interface ToolResult<T = unknown> {
  data: T;
  sources: ToolSource[];
  assumptions: string[];
  flags: ToolFlag[];
  /** How the numbers were produced (scoring-engine formulas/explanations). */
  methodology?: string[];
}

export const toolNames = [
  "rankAirports",
  "compareAirports",
  "getAirportProfile",
  "getRouteMix",
  "getUnmetDemand",
  "getLiveAirportStatus",
] as const;
export type ToolName = (typeof toolNames)[number];

const iata = z.string().length(3).transform((s) => s.toUpperCase());

export const rankAirportsInput = z.object({
  airports: z.array(iata).max(16).optional().describe("Optional IATA codes to display. Omit or leave empty for all 16 in-scope airports."),
  region: z.string().optional().describe("Optional filter: region group (New England, Southern California, Bay Area, Alaska) or US state code"),
});
export const compareAirportsInput = z.object({ a: iata, b: iata });
export const getAirportProfileInput = z.object({ airport: iata });
export const getRouteMixInput = z.object({
  airport: iata,
  cutoffMi: z.number().positive().default(3000).describe("Long-haul cutoff in miles (inclusive). Default 3000."),
  topN: z.number().int().min(1).max(30).default(10),
});
export const getUnmetDemandInput = z.object({
  airport: iata,
  topN: z.number().int().min(1).max(30).default(10),
});
export const getLiveAirportStatusInput = z.object({ airport: iata });

export const toolInputSchemas = {
  rankAirports: rankAirportsInput,
  compareAirports: compareAirportsInput,
  getAirportProfile: getAirportProfileInput,
  getRouteMix: getRouteMixInput,
  getUnmetDemand: getUnmetDemandInput,
  getLiveAirportStatus: getLiveAirportStatusInput,
} as const satisfies Record<ToolName, z.ZodTypeAny>;

export const toolDescriptions: Record<ToolName, string> = {
  rankAirports: "Rank US airports by terminal-expansion investment attractiveness using the deterministic scoring model.",
  compareAirports: "Head-to-head comparison of two airports: score components plus raw delay/congestion stats.",
  getAirportProfile: "Profile of one airport: traffic, capacity, delays, fares, score breakdown.",
  getRouteMix: "Long-haul share of departures (passenger-only and incl. cargo, at 1500/2500/3000 mi) and top routes by departures.",
  getUnmetDemand: "Unmet-demand proxy for an airport (seats x load factor above 0.85) with the high-load-factor routes/carriers behind it. The why is inferred, not measured.",
  getLiveAirportStatus: "Live FAA NAS status (delays, closures) for an airport right now.",
};
