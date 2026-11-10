import type { EvidenceItem, ToolCallRecord } from "@airport/shared";
import { config } from "./config.js";
import type { LLMMessage, LLMProvider } from "./llm/types.js";
import { executeTool, toolSpecs } from "./tools/index.js";

export const SYSTEM_PROMPT = `You are an Airport Investment Intelligence Agent that helps analysts rank and compare US airports for terminal-expansion investment.

Rules:
1. Never state a number, ranking, or fact about an airport that was not returned by a tool in this conversation. Call tools to get data.
2. Cite sources: for every claim, mention the source name(s) from the tool result's "sources".
3. State assumptions: include the tool results' "assumptions" and mention any "flags" that affect reliability.
4. If the tools do not return the data needed, say "I don't have data" for that item. Do not guess or use outside knowledge for figures.
5. If a tool returns an error, fix your arguments and retry, or explain the limitation.
Be concise and decision-oriented.`;

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
        content: JSON.stringify(out.ok ? out.result : { error: out.error }),
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
