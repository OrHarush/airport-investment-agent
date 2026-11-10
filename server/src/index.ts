import cors from "cors";
import express from "express";
import { z } from "zod";
import type { ChatMessageDTO, ChatResponse, ConversationResponse } from "@airport/shared";
import { runAgent } from "./agent.js";
import { config } from "./config.js";
import { getConversation, prisma } from "./db.js";
import { createProvider } from "./llm/index.js";
import type { LLMMessage } from "./llm/types.js";

const app = express();
app.use(cors());
app.use(express.json());
const provider = createProvider();

const toDTO = (m: any): ChatMessageDTO => ({
  id: m.id,
  role: m.role,
  content: m.content,
  toolCalls: m.toolCalls ?? null,
  evidence: m.evidence ?? null,
  createdAt: m.createdAt.toISOString(),
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: provider.name });
});

app.get("/api/conversation", async (_req, res, next) => {
  try {
    const conv = await getConversation();
    const messages = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ messages: messages.map(toDTO) } satisfies ConversationResponse);
  } catch (e) {
    next(e);
  }
});

app.delete("/api/conversation", async (_req, res, next) => {
  try {
    const conv = await getConversation();
    await prisma.message.deleteMany({ where: { conversationId: conv.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

app.post("/api/chat", async (req, res, next) => {
  try {
    const { message } = z.object({ message: z.string().trim().min(1).max(4000) }).parse(req.body);
    const conv = await getConversation();
    await prisma.message.create({ data: { conversationId: conv.id, role: "user", content: message } });

    const rows = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const history: LLMMessage[] = rows
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const { reply, evidence, toolCalls } = await runAgent(provider, history);
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: "assistant",
        content: reply,
        toolCalls: toolCalls as any,
        evidence: evidence as any,
      },
    });
    res.json({ reply, evidence } satisfies ChatResponse);
  } catch (e) {
    next(e);
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues.map((i) => i.message).join("; ") });
    return;
  }
  console.error(err);
  res.status(500).json({ error: err?.message ?? "Internal error" });
});

app.listen(config.port, () => console.log(`server on :${config.port} (provider=${provider.name})`));
