-- 프로젝트 대시보드의 AI 지출 집계(프로젝트 + 이번 달)와 프로젝트 삭제 때 SetNull 이 ai_usage 전체를 훑지 않게.

-- CreateIndex
CREATE INDEX "ai_usage_project_id_created_at_idx" ON "ai_usage"("project_id", "created_at");
