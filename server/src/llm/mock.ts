import type { LLMMessage, LLMProvider, LLMResponse, ToolSpec } from "./types.js";

/** One valid example call per tool (validated against the live schemas in mock.test.ts). */
export const MOCK_TOOL_ARGS: Record<string, Record<string, unknown>> = {
  rankAirports: { region: "New England" },
  compareAirports: { a: "LAX", b: "SNA" },
  getAirportProfile: { airport: "SFO" },
  getRouteMix: { airport: "ANC", cutoffMi: 3000, topN: 5 },
  getUnmetDemand: { airport: "SFO", topN: 5 },
  getLiveAirportStatus: { airport: "BOS" },
};

/** Deterministic fake: first turn requests a rankAirports tool call, then answers from its result. */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  async chat(messages: LLMMessage[], _tools: ToolSpec[]): Promise<LLMResponse> {
    const last = messages[messages.length - 1];
    if (last?.role === "tool") {
      return {
        content:
          "[MOCK ANSWER] This is a canned reply to the rankAirports tool result; it does not summarise real figures. " +
          "Sources, assumptions and flags are shown in the evidence panel. Not a real recommendation.",
        toolCalls: [],
        usage: null,
        rateLimit: null,
      };
    }
    return {
      content: null,
      toolCalls: [{ id: "mock_call_1", name: "rankAirports", arguments: JSON.stringify(MOCK_TOOL_ARGS.rankAirports) }],
      usage: null,
      rateLimit: null,
    };
  }
}
