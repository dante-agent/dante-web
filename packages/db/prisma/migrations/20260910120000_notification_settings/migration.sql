-- 알림(GitHub PR 코멘트 · Check Run) 설정과 그 흔적 세 테이블.
--
--   project_notification_settings  프로젝트당 1행. 무엇을 어떻게 쓸지의 설정값
--   pull_request_surfaces          PR 하나에 우리가 만든 코멘트/체크의 ID 캐시
--   notification_deliveries        전달 로그 (30일 보존)

-- CreateTable
CREATE TABLE "project_notification_settings" (
    "project_id" UUID NOT NULL,
    "pr_comment_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pr_comment_mode" TEXT NOT NULL DEFAULT 'sticky',
    "pr_comment_skip_unchanged" BOOLEAN NOT NULL DEFAULT true,
    "pr_comment_collapse_on_pass" BOOLEAN NOT NULL DEFAULT true,
    "pr_comment_fields" JSONB NOT NULL,
    "pr_comment_failed_limit" INTEGER NOT NULL DEFAULT 10,
    "check_run_enabled" BOOLEAN NOT NULL DEFAULT true,
    "check_run_blocking" BOOLEAN NOT NULL DEFAULT false,
    "branch_filters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skip_draft_pr" BOOLEAN NOT NULL DEFAULT true,
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_notification_settings_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "pull_request_surfaces" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "comment_id" BIGINT,
    "check_run_id" BIGINT,
    "last_conclusion" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_request_surfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "surface" TEXT NOT NULL,
    "pr_number" INTEGER,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_surfaces_project_id_pr_number_key" ON "pull_request_surfaces"("project_id", "pr_number");

-- CreateIndex
CREATE INDEX "notification_deliveries_project_id_created_at_idx" ON "notification_deliveries"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_notification_settings" ADD CONSTRAINT "project_notification_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_surfaces" ADD CONSTRAINT "pull_request_surfaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 새 테이블도 RLS ON, 정책 없음 (20260908141613_enable_rls 참고).
-- 켜는 걸 잊으면 anon 키로 PostgREST 를 통해 그대로 읽힌다.
ALTER TABLE "public"."project_notification_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pull_request_surfaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_deliveries" ENABLE ROW LEVEL SECURITY;
