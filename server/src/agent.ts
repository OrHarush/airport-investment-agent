import type { EvidenceItem, LlmRateLimit, LlmUsage, ToolCallRecord } from "@airport/shared";
import { config } from "./config.js";
import type { LLMMessage, LLMProvider, LLMResponse } from "./llm/types.js";
import { SYSTEM_PROMPT } from "./agent/systemPrompt.js";
import { compactForModel, estimateTokens } from "./tools/compact.js";
import { executeTool, toolSpecs } from "./tools/index.js";

export { SYSTEM_PROMPT };

export interface AgentResult {
  reply: string;
  evidence: EvidenceItem[];
  toolCalls: ToolCallRecord[];
  /** Tokens summed over all LLM rounds of this answer; null when the provider reports none (mock). */
  usage: LlmUsage | null;
  /** Rate-limit window after the last round; null when the provider reports none (mock). */
  rateLimit: LlmRateLimit | null;
}

export async function runAgent(provider: LLMProvider, history: LLMMessage[]): Promise<AgentResult> {
  const messages: LLMMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  const evidence: EvidenceItem[] = [];
  const toolCalls: ToolCallRecord[] = [];
  let usage: LlmUsage | null = null;
  let rateLimit: LlmRateLimit | null = null;
  const track = (res: LLMResponse) => {
    if (res.usage) {
      usage = {
        promptTokens: (usage?.promptTokens ?? 0) + res.usage.promptTokens,
        completionTokens: (usage?.completionTokens ?? 0) + res.usage.completionTokens,
        totalTokens: (usage?.totalTokens ?? 0) + res.usage.totalTokens,
        rounds: (usage?.rounds ?? 0) + 1,
      };
    }
    if (res.rateLimit) rateLimit = res.rateLimit;
  };

  for (let i = 0; i < config.maxIterations; i++) {
    const res = await provider.chat(messages, toolSpecs);
    track(res);
    if (!res.toolCalls.length) {
      return { reply: res.content ?? "", evidence, toolCalls, usage, rateLimit };
    }
    messages.push({ role: "assistant", content: res.content, toolCalls: res.toolCalls });
    for (const call of res.toolCalls) {
      const out = await executeTool(call.name, call.arguments);
      toolCalls.push({ id: call.id, name: call.name, arguments: out.args, ...(out.ok ? {} : { error: out.error }) });
      if (out.ok) evidence.push({ tool: call.name, ...out.result });
      // UI evidence keeps the full result; the model gets the compact copy (Groq 8k tokens/min).
      const content = JSON.stringify(out.ok ? compactForModel(call.name, out.result) : { error: out.error });
      console.log(`[tool] ${call.name}: ~${estimateTokens(content)} tokens to model${out.ok ? ` (full result ~${estimateTokens(out.result)})` : " (error)"}`);
      messages.push({ role: "tool", toolCallId: call.id, content });
    }
  }

  // Iteration cap hit: force a final answer without tools.
  messages.push({
    role: "user",
    content:
      'Tool-call limit reached. Give your best final answer using only the data already returned; say "I don\'t have data" for anything missing.',
  });
  const final = await provider.chat(messages, []);
  track(final);
  return { reply: final.content ?? "I don't have enough data to answer.", evidence, toolCalls, usage, rateLimit };
}
