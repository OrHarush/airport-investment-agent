import OpenAI from "openai";
import type { LLMMessage, LLMProvider, LLMResponse, ToolSpec } from "./types.js";

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  private client: OpenAI;

  constructor(
    apiKey: string,
    baseURL: string,
    private model: string,
  ) {
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    this.client = new OpenAI({ apiKey, baseURL });
  }

  /** No fallback model: on a provider error the real message is thrown and shown to the user. */
  async chat(messages: LLMMessage[], tools: ToolSpec[]): Promise<LLMResponse> {
    try {
      return await this.call(this.model, messages, tools);
    } catch (err) {
      throw new Error(describeGroqError(err));
    }
  }

  private async call(model: string, messages: LLMMessage[], tools: ToolSpec[]): Promise<LLMResponse> {
    const res = await this.client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: messages.map(toOpenAI),
      ...(tools.length && {
        tools: tools.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: "auto" as const,
      }),
    });
    const msg = res.choices[0]?.message;
    return {
      content: msg?.content ?? null,
      toolCalls: (msg?.tool_calls ?? [])
        .filter((c) => c.type === "function")
        .map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
    };
  }
}

function toOpenAI(m: LLMMessage): OpenAI.Chat.ChatCompletionMessageParam {
  switch (m.role) {
    case "tool":
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    case "assistant":
      return {
        role: "assistant",
        content: m.content,
        ...(m.toolCalls?.length && {
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: c.arguments },
          })),
        }),
      };
    default:
      return { role: m.role, content: m.content };
  }
}

/** "Groq 413: Request too large ..." style message from an OpenAI-SDK error; other errors keep their message. */
export function describeGroqError(err: unknown): string {
  const e = err as { status?: number; message?: string; error?: { message?: string } };
  const msg = e?.error?.message ?? e?.message ?? String(err);
  return `Groq error${e?.status ? ` ${e.status}` : ""}: ${msg.replace(/^\d{3}\s+/, "")}`;
}
