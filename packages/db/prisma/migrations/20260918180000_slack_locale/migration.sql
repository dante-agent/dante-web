-- Slack 메시지 언어. Discord 의 discord_locale 과 같은 모양이다.

-- AlterTable
ALTER TABLE "project_notification_settings" ADD COLUMN     "slack_locale" TEXT NOT NULL DEFAULT 'en';
