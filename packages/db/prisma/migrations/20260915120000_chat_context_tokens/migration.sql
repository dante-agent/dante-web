-- 대화의 컨텍스트 게이지를 메시지 개수 대신 실제 토큰으로 센다.
-- 기존 대화는 0 으로 시작한다 — 다음 답이 끝나면 실제 값으로 채워진다.

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN "context_tokens" INTEGER NOT NULL DEFAULT 0;
