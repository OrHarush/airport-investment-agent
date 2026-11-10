import type { ToolResult } from "./tools.js";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: unknown;
  error?: string;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallRecord[] | null;
  evidence?: EvidenceItem[] | null;
  createdAt: string;
}

/** A ToolResult tagged with the tool that produced it. */
export interface EvidenceItem extends ToolResult {
  tool: string;
}

/** Token usage of one answer, summed over every LLM round. */
export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  rounds: number;
}
/** Provider rate-limit window as reported by the provider's x-ratelimit-* headers (Groq: per minute). */
export interface LlmRateLimit {
  tokensLimit: number | null;
  tokensRemaining: number | null;
  /** Seconds until the token window resets. */
  resetTokens: number | null;
  requestsLimit: number | null;
  requestsRemaining: number | null;
  resetRequests: number | null;
}

export interface ChatRequest { message: string }
export interface ChatResponse { reply: string; evidence: EvidenceItem[]; usage: LlmUsage | null; rateLimit: LlmRateLimit | null }
export interface ConversationResponse { messages: ChatMessageDTO[] }
