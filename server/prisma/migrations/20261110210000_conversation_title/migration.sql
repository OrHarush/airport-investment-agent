-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "title" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: last activity = newest message, else creation time
UPDATE "Conversation" c
SET "updatedAt" = COALESCE((SELECT MAX(m."createdAt") FROM "Message" m WHERE m."conversationId" = c."id"), c."createdAt");

-- Prisma manages @updatedAt itself; drop the temporary default
ALTER TABLE "Conversation" ALTER COLUMN "updatedAt" DROP DEFAULT;
