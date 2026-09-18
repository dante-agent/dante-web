-- AlterTable
ALTER TABLE "project_notification_settings" ADD COLUMN     "discord_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discord_events" JSONB,
ADD COLUMN     "encrypted_discord_webhook_url" TEXT;

-- AlterTable
ALTER TABLE "pull_request_surfaces" ADD COLUMN     "discord_message_id" TEXT,
ADD COLUMN     "discord_outcome" TEXT;
