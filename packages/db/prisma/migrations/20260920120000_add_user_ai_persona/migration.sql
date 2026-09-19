-- AlterTable
ALTER TABLE "users" ADD COLUMN "ai_persona" TEXT NOT NULL DEFAULT 'balanced',
ADD COLUMN "ai_instructions" TEXT;
