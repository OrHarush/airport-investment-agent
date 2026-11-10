import { toolInputSchemas, toolNames } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { MOCK_TOOL_ARGS, MockProvider } from "./mock.js";

describe("MockProvider", () => {
  it("has example args for every tool, valid against the current schemas", () => {
    expect(Object.keys(MOCK_TOOL_ARGS).sort()).toEqual([...toolNames].sort());
    for (const name of toolNames) {
      const parsed = toolInputSchemas[name].safeParse(MOCK_TOOL_ARGS[name]);
      expect(parsed.success, `${name}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
    }
  });

  it("the tool call it actually emits validates against its schema", async () => {
    const res = await new MockProvider().chat([{ role: "user", content: "hi" }], []);
    expect(res.toolCalls).toHaveLength(1);
    const call = res.toolCalls[0]!;
    expect((toolNames as readonly string[]).includes(call.name)).toBe(true);
    const parsed = toolInputSchemas[call.name as (typeof toolNames)[number]].safeParse(JSON.parse(call.arguments));
    expect(parsed.success).toBe(true);
  });
});
