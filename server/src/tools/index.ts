import { zodToJsonSchema } from "zod-to-json-schema";
import {
  toolDescriptions,
  toolInputSchemas,
  toolNames,
  type ToolName,
  type ToolResult,
} from "@airport/shared";
import type { ToolSpec } from "../llm/types.js";

type Handler = (input: any) => Promise<ToolResult>;

const stub = (data: unknown): ToolResult => ({
  data,
  sources: [{ name: "MOCK stub (no real data yet)", url: "https://example.com/mock", retrievedAt: new Date().toISOString() }],
  assumptions: ["Stub tool: values are placeholders, not real analysis."],
  flags: ["MOCK_DATA"],
});

/** Stubs. Replace with real implementations backed by the scoring engine / DB. */
const handlers: Record<ToolName, Handler> = {
  rankAirports: async (i) =>
    stub({
      ranking: ["XXX", "YYY", "ZZZ", "AAA", "BBB"].slice(0, i.limit).map((code, idx) => ({
        rank: idx + 1,
        airport: code,
        score: +(0.82 - idx * 0.07).toFixed(2),
      })),
    }),
  compareAirports: async (i) =>
    stub({ airports: i.airports.map((a: string) => ({ airport: a, score: 0.5, growth: 0.1 })) }),
  getAirportProfile: async (i) => stub({ airport: i.airport, passengers: 1_000_000, avgDelayMin: 12.3 }),
  getRouteMix: async (i) =>
    stub({ airport: i.airport, routes: [{ dest: "ATL", passengers: 120000 }, { dest: "ORD", passengers: 90000 }] }),
  getUnmetDemand: async (i) => stub({ airport: i.airport, unmetDemandIndex: 0.37 }),
  getLiveAirportStatus: async (i) => stub({ airport: i.airport, status: "normal", delayMin: 0 }),
};

export const toolSpecs: ToolSpec[] = toolNames.map((name) => {
  const { $schema, ...parameters } = zodToJsonSchema(toolInputSchemas[name], { target: "openApi3" }) as any;
  return { name, description: toolDescriptions[name], parameters };
});

export type ExecOutcome =
  | { ok: true; result: ToolResult; args: unknown }
  | { ok: false; error: string; args: unknown };

/** Parse + validate model-supplied arguments, then run the tool. Never throws. */
export async function executeTool(name: string, rawArgs: string): Promise<ExecOutcome> {
  if (!(toolNames as readonly string[]).includes(name)) {
    return { ok: false, error: `Unknown tool "${name}". Available: ${toolNames.join(", ")}`, args: rawArgs };
  }
  let json: unknown;
  try {
    json = rawArgs?.trim() ? JSON.parse(rawArgs) : {};
  } catch (e) {
    return { ok: false, error: `Arguments are not valid JSON: ${(e as Error).message}`, args: rawArgs };
  }
  const parsed = toolInputSchemas[name as ToolName].safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`).join("; ");
    return { ok: false, error: `Invalid arguments: ${issues}`, args: json };
  }
  try {
    return { ok: true, result: await handlers[name as ToolName](parsed.data), args: parsed.data };
  } catch (e) {
    return { ok: false, error: `Tool failed: ${(e as Error).message}`, args: parsed.data };
  }
}
