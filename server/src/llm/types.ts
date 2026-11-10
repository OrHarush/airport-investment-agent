import type { LlmRateLimit } from "@airport/shared";

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string; // raw JSON string from the model
}

export type LLMMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LLMToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface LLMResponse {
  content: string | null;
  toolCalls: LLMToolCall[];
  /** Tokens for this completion (null: provider does not report). */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  /** Latest rate-limit headers (null: provider has none, e.g. mock). */
  rateLimit?: LlmRateLimit | null;
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: LLMMessage[], tools: ToolSpec[]): Promise<LLMResponse>;
}
