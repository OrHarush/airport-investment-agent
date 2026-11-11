import { Router } from "express";
import { z } from "zod";
import type { ChatMessageDTO } from "@airport/shared";
import { runAgent } from "../agent.js";
import { buildHistory } from "../agent/history.js";
import { prisma } from "../db.js";
import { getLlmStatus, recordLlmStatus } from "../llm/status.js";
import type { LLMMessage, LLMProvider } from "../llm/types.js";

const TITLE_MAX = 50;

/** First user message, cut at a word boundary to ~50 chars. */
export function deriveTitle(firstUserMessage: string | null | undefined): string {
  const t = (firstUserMessage ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  if (t.length <= TITLE_MAX) return t;
  const cut = t.slice(0, TITLE_MAX);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 30 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

const toDTO = (m: any): ChatMessageDTO => ({
  id: m.id,
  role: m.role,
  content: m.content,
  toolCalls: m.toolCalls ?? null,
  evidence: m.evidence ?? null,
  createdAt: m.createdAt.toISOString(),
});

const withFirstUserMessage = { messages: { where: { role: "user" }, orderBy: { createdAt: "asc" as const }, take: 1, select: { content: true } } };

const summary = (c: { id: string; title: string | null; createdAt: Date; updatedAt: Date; messages?: { content: string }[] }) => ({
  id: c.id,
  title: c.title ?? deriveTitle(c.messages?.[0]?.content),
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

class NotFound extends Error {}

async function findOrThrow(id: string) {
  const c = await prisma.conversation.findUnique({ where: { id }, include: withFirstUserMessage });
  if (!c) throw new NotFound("Conversation not found");
  return c;
}

export function conversationRouter(provider: LLMProvider) {
  const r = Router();

  r.get("/conversations", async (_req, res, next) => {
    try {
      const rows = await prisma.conversation.findMany({ orderBy: { updatedAt: "desc" }, include: withFirstUserMessage });
      res.json({ conversations: rows.map(summary) });
    } catch (e) {
      next(e);
    }
  });

  r.post("/conversations", async (_req, res, next) => {
    try {
      const c = await prisma.conversation.create({ data: {}, include: withFirstUserMessage });
      res.status(201).json(summary(c));
    } catch (e) {
      next(e);
    }
  });

  r.get("/conversations/:id", async (req, res, next) => {
    try {
      const c = await findOrThrow(req.params.id);
      const messages = await prisma.message.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: "asc" } });
      res.json({ ...summary(c), messages: messages.map(toDTO) });
    } catch (e) {
      next(e);
    }
  });

  r.patch("/conversations/:id", async (req, res, next) => {
    try {
      const { title } = z.object({ title: z.string().trim().min(1, "Title cannot be empty").max(120) }).parse(req.body);
      const existing = await findOrThrow(req.params.id);
      // Renaming is not activity: keep updatedAt (otherwise @updatedAt would bump it and reorder the list).
      const c = await prisma.conversation.update({ where: { id: req.params.id }, data: { title, updatedAt: existing.updatedAt }, include: withFirstUserMessage });
      res.json(summary(c));
    } catch (e) {
      next(e);
    }
  });

  r.delete("/conversations/:id", async (req, res, next) => {
    try {
      await findOrThrow(req.params.id);
      await prisma.conversation.delete({ where: { id: req.params.id } }); // messages cascade
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.get("/llm-usage", (_req, res) => {
    res.json(getLlmStatus());
  });

  r.post("/chat", async (req, res, next) => {
    try {
      const { conversationId, message } = z
        .object({ conversationId: z.string().min(1).optional(), message: z.string().trim().min(1).max(4000) })
        .parse(req.body);
      // No id: start a new conversation (keeps older clients working).
      const conv = conversationId ? await findOrThrow(conversationId) : await prisma.conversation.create({ data: {}, include: withFirstUserMessage });

      const userMsg = await prisma.message.create({ data: { conversationId: conv.id, role: "user", content: message } });
      const rows = await prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "desc" }, take: 20 });
      const history = buildHistory(rows.reverse());

      let result;
      try {
        result = await runAgent(provider, history);
      } catch (e) {
        // Don't leave the question dangling: the client retries by resending it.
        await prisma.message.delete({ where: { id: userMsg.id } }).catch(() => {});
        throw e;
      }
      const { reply, evidence, toolCalls, usage, rateLimit } = result;
      recordLlmStatus(usage, rateLimit);
      const assistant = await prisma.message.create({
        data: { conversationId: conv.id, role: "assistant", content: reply, toolCalls: toolCalls as any, evidence: evidence as any },
      });
      const updated = await prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() }, include: withFirstUserMessage });
      res.json({ conversation: summary(updated), reply, evidence, message: toDTO(assistant), usage, rateLimit });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

export { NotFound };
