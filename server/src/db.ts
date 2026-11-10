import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Single-conversation app: get or create the one conversation. */
export async function getConversation() {
  const existing = await prisma.conversation.findFirst({ orderBy: { createdAt: "asc" } });
  return existing ?? prisma.conversation.create({ data: {} });
}
