-- 프로젝트가 Slack 어느 채널로 무엇을 보낼지. 워크스페이스는 팀(slack_installations)에 붙는다.

-- AlterTable
ALTER TABLE "project_notification_settings" ADD COLUMN     "slack_channel_id" TEXT,
ADD COLUMN     "slack_channel_name" TEXT,
ADD COLUMN     "slack_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slack_events" JSONB NOT NULL DEFAULT '{}';
