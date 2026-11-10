import { describe, expect, it } from "vitest";
import { classifyGroqError } from "./groq.js";

const e = (status: number, message: string, headers?: Record<string, string>) =>
  Object.assign(new Error(message), { status, headers: { get: (k: string) => headers?.[k] ?? null } });

describe("classifyGroqError", () => {
  it("429 daily limit: rate_limit with the retry delay from the message", () => {
    const c = classifyGroqError(e(429, "429 Rate limit reached ... Please try again in 17m14.639999999s. Need more tokens?"));
    expect(c.kind).toBe("rate_limit");
    expect(c.retryAfterSeconds).toBeCloseTo(17 * 60 + 14.6, 0);
  });
  it("429 prefers the retry-after header", () => {
    expect(classifyGroqError(e(429, "limit", { "retry-after": "12" })).retryAfterSeconds).toBe(12);
  });
  it("maps other statuses", () => {
    expect(classifyGroqError(e(413, "Request too large")).kind).toBe("too_large");
    expect(classifyGroqError(e(401, "bad key")).kind).toBe("auth");
    expect(classifyGroqError(e(400, "Tool call validation failed")).kind).toBe("model");
    expect(classifyGroqError(e(503, "down")).kind).toBe("unavailable");
  });
});
