import type { ApiErrorBody, ChatMessageDTO, ErrorKind, EvidenceItem, LlmRateLimit, LlmUsage } from "@airport/shared";

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
  const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
  if (!res.ok) throw new ApiError(body.error ?? "Request failed", res.status, body.kind, body.retryAt);
  return body as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public kind?: ErrorKind, public retryAt?: string) {
    super(message);
  }
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Plain-language message for any failure. Never shows status codes or raw server/provider text. */
export function friendlyError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Can’t reach the server. Check your connection and try again.";
  switch (e.kind) {
    case "rate_limit": {
      const at = e.retryAt ? new Date(e.retryAt) : null;
      const secs = at ? Math.max(0, Math.round((at.getTime() - Date.now()) / 1000)) : null;
      if (at && secs !== null) return secs <= 90 ? `The AI model has reached its usage limit. Try again in ${Math.max(secs, 5)} seconds.` : `The AI model has reached its usage limit. Try again at ${clock(at)}.`;
      return "The AI model has reached its usage limit. Try again in a few minutes.";
    }
    case "too_large": return "This question needs more data than the AI model can take at once. Try a narrower question.";
    case "auth": return "The AI model isn’t set up correctly on the server, so it can’t answer right now.";
    case "model": return "The AI model couldn’t complete this request. Try again or rephrase the question.";
    case "unavailable": return "The AI model is temporarily unavailable. Try again in a moment.";
    default:
      return e.status === 400 ? "That message couldn’t be sent. Check it and try again." : "Something went wrong on the server. Try again in a moment.";
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

export const getLlmUsage = () =>
  send("GET", "/api/llm-usage").then((r) => json<{ usage: LlmUsage | null; rateLimit: LlmRateLimit | null; receivedAt: number; sessionTokens: number } | null>(r));
