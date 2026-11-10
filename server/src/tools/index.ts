import { zodToJsonSchema } from "zod-to-json-schema";
import {
  toolDescriptions,
  toolInputSchemas,
  toolNames,
  type ToolName,
  type ToolResult,
} from "@airport/shared";
import type { ToolSpec } from "../llm/types.js";
import { compareAirports } from "./compareAirports.js";
import { getAirportProfile } from "./getAirportProfile.js";
import { getRouteMix } from "./getRouteMix.js";
import { getUnmetDemand } from "./getUnmetDemand.js";
import { getLiveAirportStatus } from "./liveStatus.js";
import { rankAirports } from "./rankAirports.js";

type Handler = (input: any) => Promise<ToolResult>;

const handlers: Record<ToolName, Handler> = {
  rankAirports,
  compareAirports,
  getAirportProfile,
  getRouteMix,
  getUnmetDemand,
  getLiveAirportStatus: (i) => getLiveAirportStatus(i),
};

export const toolSpecs: ToolSpec[] = toolNames.map((name) => {
  const { $schema, ...parameters } = zodToJsonSchema(toolInputSchemas[name], { target: "jsonSchema7" }) as any;
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
