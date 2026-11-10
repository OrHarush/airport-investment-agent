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
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: LLMMessage[], tools: ToolSpec[]): Promise<LLMResponse>;
}
