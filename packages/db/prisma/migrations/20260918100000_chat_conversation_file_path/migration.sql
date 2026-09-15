-- AI 채팅 대화를 파일마다 따로 둔다. 대화에 파일 경로를 달고, 목록을 파일로 거른다.

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN "file_path" TEXT;

-- 기존 대화는 첫 메시지를 보낼 때 열어 둔 파일로 채운다. 파일 없이 시작한 대화는 null 로 남는다.
UPDATE "chat_conversations" AS c
SET "file_path" = (
  SELECT m."file_path"
  FROM "chat_messages" AS m
  WHERE m."conversation_id" = c."id"
  ORDER BY m."created_at" ASC
  LIMIT 1
);

-- DropIndex
DROP INDEX "chat_conversations_user_id_project_id_updated_at_idx";

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_project_id_file_path_updated_at_idx" ON "chat_conversations"("user_id", "project_id", "file_path", "updated_at");
