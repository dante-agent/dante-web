-- PR 하나에 보낸 Slack 메시지의 좌표. 같은 결론은 고쳐 쓰고, 바뀐 결론은 스레드에 단다.

-- AlterTable
ALTER TABLE "pull_request_surfaces" ADD COLUMN     "slack_channel_id" TEXT,
ADD COLUMN     "slack_last_event" TEXT,
ADD COLUMN     "slack_message_ts" TEXT,
ADD COLUMN     "slack_thread_ts" TEXT;
