-- ai_usage 행을 호출 전에 "예약"으로 만들고, 끝나면 실제 사용량으로 정산한다 (lib/ai/budget.ts).
-- settled_at 이 null 이면 예약 중이다.
ALTER TABLE "ai_usage" ADD COLUMN "settled_at" TIMESTAMP(3);

-- 지금까지의 행은 호출이 끝난 뒤에 기록한 것이라 모두 정산된 상태다.
UPDATE "ai_usage" SET "settled_at" = "created_at";
