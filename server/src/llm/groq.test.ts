import { describe, expect, it } from "vitest";
import { parseDurationSeconds, parseRateLimit } from "./groq.js";
import { MockProvider } from "./mock.js";

describe("Groq rate-limit parsing", () => {
  it("parses reset durations to seconds", () => {
    expect(parseDurationSeconds("7.66s")).toBe(7.7);
    expect(parseDurationSeconds("2m59.56s")).toBe(179.6);
    expect(parseDurationSeconds("1h2m3s")).toBe(3723);
    expect(parseDurationSeconds("850ms")).toBe(0.9);
    expect(parseDurationSeconds("41")).toBe(41);
    expect(parseDurationSeconds(null)).toBeNull();
  });
  it("reads x-ratelimit headers; null when absent", () => {
    const h = new Headers({
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "2800",
      "x-ratelimit-reset-tokens": "41s",
      "x-ratelimit-limit-requests": "1000",
      "x-ratelimit-remaining-requests": "990",
      "x-ratelimit-reset-requests": "2m52.8s",
    });
    expect(parseRateLimit(h)).toEqual({ tokensLimit: 8000, tokensRemaining: 2800, resetTokens: 41, requestsLimit: 1000, requestsRemaining: 990, resetRequests: 172.8 });
    expect(parseRateLimit(new Headers())).toBeNull();
  });
  it("mock provider reports no usage", async () => {
    const r = await new MockProvider().chat([{ role: "user", content: "hi" }], []);
    expect(r.usage).toBeNull();
    expect(r.rateLimit).toBeNull();
  });
});
