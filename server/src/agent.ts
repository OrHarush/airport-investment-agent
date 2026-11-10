import type { EvidenceItem, ToolCallRecord } from "@airport/shared";
import { config } from "./config.js";
import type { LLMMessage, LLMProvider } from "./llm/types.js";
import { SYSTEM_PROMPT } from "./agent/systemPrompt.js";
import { compactForModel } from "./tools/compact.js";
import { executeTool, toolSpecs } from "./tools/index.js";

export { SYSTEM_PROMPT };

export interface AgentResult {
  reply: string;
  evidence: EvidenceItem[];
  toolCalls: ToolCallRecord[];
}

export async function runAgent(provider: LLMProvider, history: LLMMessage[]): Promise<AgentResult> {
  const messages: LLMMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  const evidence: EvidenceItem[] = [];
  const toolCalls: ToolCallRecord[] = [];

  for (let i = 0; i < config.maxIterations; i++) {
    const res = await provider.chat(messages, toolSpecs);
    if (!res.toolCalls.length) {
      return { reply: res.content ?? "", evidence, toolCalls };
    }
    messages.push({ role: "assistant", content: res.content, toolCalls: res.toolCalls });
    for (const call of res.toolCalls) {
      const out = await executeTool(call.name, call.arguments);
      toolCalls.push({ id: call.id, name: call.name, arguments: out.args, ...(out.ok ? {} : { error: out.error }) });
      if (out.ok) evidence.push({ tool: call.name, ...out.result });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        // UI evidence keeps the full result; the model gets the compact copy (Groq 8k tokens/min).
        content: JSON.stringify(out.ok ? compactForModel(call.name, out.result) : { error: out.error }),
      });
    }
  }

  // Iteration cap hit: force a final answer without tools.
  messages.push({
    role: "user",
    content:
      'Tool-call limit reached. Give your best final answer using only the data already returned; say "I don\'t have data" for anything missing.',
  });
  const final = await provider.chat(messages, []);
  return { reply: final.content ?? "I don't have enough data to answer.", evidence, toolCalls };
}
