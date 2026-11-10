import type { ChatResponse, ConversationResponse } from "@airport/shared";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

export const getConversation = () => fetch("/api/conversation").then((r) => json<ConversationResponse>(r));

export const sendChat = (message: string) =>
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }).then((r) => json<ChatResponse>(r));

export const clearConversation = () => fetch("/api/conversation", { method: "DELETE" });
