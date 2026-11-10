import { z } from "zod";

export interface ToolSource {
  name: string;
  url: string;
  retrievedAt: string;
}

export interface ToolResult<T = unknown> {
  data: T;
  sources: ToolSource[];
  assumptions: string[];
  flags: string[];
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
  limit: z.number().int().min(1).max(50).default(10),
  region: z.string().optional().describe("Optional US state/region filter"),
  minPassengers: z.number().nonnegative().optional(),
});
export const compareAirportsInput = z.object({
  airports: z.array(iata).min(2).max(5).describe("IATA codes"),
});
export const getAirportProfileInput = z.object({ airport: iata });
export const getRouteMixInput = z.object({
  airport: iata,
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
  compareAirports: "Side-by-side comparison of 2-5 airports on score components.",
  getAirportProfile: "Profile of one airport: traffic, capacity, delays, fares, score breakdown.",
  getRouteMix: "Route/carrier mix for an airport (top routes by passengers).",
  getUnmetDemand: "Estimate of unmet demand for an airport (fare/load-factor based signals).",
  getLiveAirportStatus: "Live FAA NAS status (delays, closures) for an airport right now.",
};
