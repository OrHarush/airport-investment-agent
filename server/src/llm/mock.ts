import type { LLMMessage, LLMProvider, LLMResponse, ToolSpec } from "./types.js";

/** Deterministic fake: first turn requests a rankAirports tool call, then answers from its result. */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  async chat(messages: LLMMessage[], _tools: ToolSpec[]): Promise<LLMResponse> {
    const last = messages[messages.length - 1];
    if (last?.role === "tool") {
      return {
        content:
          "[MOCK ANSWER] Based on the rankAirports tool result, the top-ranked airport is XXX with score 0.82. " +
          "Sources and assumptions are shown in the evidence panel. This is mock data, not a real recommendation.",
        toolCalls: [],
      };
    }
    return {
      content: null,
      toolCalls: [{ id: "mock_call_1", name: "rankAirports", arguments: JSON.stringify({ limit: 3 }) }],
    };
  }
}
