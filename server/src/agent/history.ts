import type { LLMMessage } from "../llm/types.js";

/** Chat history is the biggest variable cost per request (Groq free tier: 8,000 tokens/min, about 4 chars per token). */
export const HISTORY_MAX_MESSAGES = 8;
export const HISTORY_CHAR_BUDGET = 8000;
/** The latest assistant answer is kept nearly whole so "those airports" and "the second one" still resolve. */
export const LAST_ASSISTANT_MAX_CHARS = 3000;
/** Older assistant answers are cut to a gist. */
export const OLD_ASSISTANT_MAX_CHARS = 400;

const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max).trimEnd()} ...`);

/**
 * Pick the part of a conversation (oldest first) that is sent to the model.
 * Always keeps the newest message in full, shrinks older assistant answers, and stops at the budget.
 * Tool results are never part of history, so old numbers must be fetched again by the tools.
 */
export function buildHistory(rows: { role: string; content: string }[]): LLMMessage[] {
  const out: LLMMessage[] = [];
  let used = 0;
  let seenAssistant = false;
  for (let i = rows.length - 1; i >= 0 && out.length < HISTORY_MAX_MESSAGES; i--) {
    const m = rows[i];
    const role = m.role as "user" | "assistant";
    let content = m.content;
    if (role === "assistant") {
      content = cut(content, seenAssistant ? OLD_ASSISTANT_MAX_CHARS : LAST_ASSISTANT_MAX_CHARS);
      seenAssistant = true;
    }
    if (out.length > 0 && used + content.length > HISTORY_CHAR_BUDGET) break;
    used += content.length;
    out.push({ role, content });
  }
  out.reverse();
  // The model API expects the conversation to start with a user turn.
  while (out.length > 1 && out[0].role !== "user") out.shift();
  return out;
}
