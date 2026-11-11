import { describe, expect, it } from "vitest";
import { buildHistory, HISTORY_MAX_MESSAGES, LAST_ASSISTANT_MAX_CHARS, OLD_ASSISTANT_MAX_CHARS } from "./history.js";

const u = (c: string) => ({ role: "user", content: c });
const a = (c: string) => ({ role: "assistant", content: c });

describe("buildHistory", () => {
  it("keeps a short conversation unchanged", () => {
    const rows = [u("hi"), a("hello"), u("rank")];
    expect(buildHistory(rows)).toEqual(rows);
  });

  it("keeps the latest user message in full and the last answer nearly whole", () => {
    const big = "x".repeat(5000);
    const h = buildHistory([u("q1"), a(big), u("which of those?")]);
    expect(h[h.length - 1].content).toBe("which of those?");
    expect((h[1].content as string).length).toBeLessThanOrEqual(LAST_ASSISTANT_MAX_CHARS + 4);
  });

  it("shrinks older assistant answers to a gist", () => {
    const big = "y".repeat(3000);
    const h = buildHistory([u("q1"), a(big), u("q2"), a(big), u("q3")]);
    const assistants = h.filter((m) => m.role === "assistant").map((m) => m.content as string);
    expect(assistants[0].length).toBeLessThanOrEqual(OLD_ASSISTANT_MAX_CHARS + 4);
    expect(assistants[1].length).toBeGreaterThan(OLD_ASSISTANT_MAX_CHARS + 4);
  });

  it("caps message count and always starts with a user turn", () => {
    const rows = Array.from({ length: 29 }, (_, i) => (i % 2 === 0 ? u(`q${i}`) : a(`a${i}`)));
    const h = buildHistory(rows);
    expect(h.length).toBeLessThanOrEqual(HISTORY_MAX_MESSAGES);
    expect(h[0].role).toBe("user");
    expect(h[h.length - 1].content).toBe("q28");
  });

  it("always includes the newest message even if it is huge", () => {
    const h = buildHistory([u("a".repeat(20000))]);
    expect(h).toHaveLength(1);
  });
});
