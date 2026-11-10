import type { ChatMessageDTO, EvidenceItem, LlmRateLimit, LlmUsage } from "@airport/shared";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessageDTO[];
}
export interface ChatReply {
  conversation: ConversationSummary;
  reply: string;
  evidence: EvidenceItem[];
  message: ChatMessageDTO;
  usage: LlmUsage | null;
  rateLimit: LlmRateLimit | null;
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const send = (method: string, url: string, body?: unknown) =>
  fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

export const listConversations = () => send("GET", "/api/conversations").then((r) => json<{ conversations: ConversationSummary[] }>(r)).then((x) => x.conversations);
export const createConversation = () => send("POST", "/api/conversations").then((r) => json<ConversationSummary>(r));
export const getConversation = (id: string) => send("GET", `/api/conversations/${encodeURIComponent(id)}`).then((r) => json<ConversationDetail>(r));
export const renameConversation = (id: string, title: string) => send("PATCH", `/api/conversations/${encodeURIComponent(id)}`, { title }).then((r) => json<ConversationSummary>(r));
export const deleteConversation = (id: string) => send("DELETE", `/api/conversations/${encodeURIComponent(id)}`).then((r) => json<void>(r));
export const sendChat = (conversationId: string, message: string) => send("POST", "/api/chat", { conversationId, message }).then((r) => json<ChatReply>(r));
