import type { LlmRateLimit, LlmUsage } from "@airport/shared";

/** What the last answer reported, kept in server memory so the UI can show it again after a refresh. Cleared when the server restarts. */
export interface LlmStatus {
  usage: LlmUsage | null;
  rateLimit: LlmRateLimit | null;
  /** Epoch ms when the last answer finished (the reset countdown counts from here). */
  receivedAt: number;
  /** Tokens used by all answers since the server started. */
  sessionTokens: number;
}

let last: LlmStatus | null = null;
let sessionTokens = 0;

export function recordLlmStatus(usage: LlmUsage | null, rateLimit: LlmRateLimit | null): void {
  if (!usage && !rateLimit) return; // mock provider reports nothing
  sessionTokens += usage?.totalTokens ?? 0;
  last = { usage, rateLimit, receivedAt: Date.now(), sessionTokens };
}

export const getLlmStatus = (): LlmStatus | null => last;
