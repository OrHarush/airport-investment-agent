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

export interface ChatRequest { message: string }
export interface ChatResponse { reply: string; evidence: EvidenceItem[] }
export interface ConversationResponse { messages: ChatMessageDTO[] }
