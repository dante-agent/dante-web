-- CreateTable
CREATE TABLE "components" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "export_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_files" (
    "id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_file_versions" (
    "id" UUID NOT NULL,
    "test_file_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" UUID NOT NULL,
    "test_file_version_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "exit_code" INTEGER,
    "logs" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "components_project_id_file_path_export_name_key" ON "components"("project_id", "file_path", "export_name");

-- CreateIndex
CREATE UNIQUE INDEX "test_files_component_id_key" ON "test_files"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_file_versions_test_file_id_version_key" ON "test_file_versions"("test_file_id", "version");

-- CreateIndex
CREATE INDEX "test_runs_test_file_version_id_created_at_idx" ON "test_runs"("test_file_version_id", "created_at");

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_files" ADD CONSTRAINT "test_files_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_file_versions" ADD CONSTRAINT "test_file_versions_test_file_id_fkey" FOREIGN KEY ("test_file_id") REFERENCES "test_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_file_version_id_fkey" FOREIGN KEY ("test_file_version_id") REFERENCES "test_file_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 새 테이블도 RLS ON, 정책 없음 (20260908141613_enable_rls 와 같은 이유).
-- 빠뜨리면 anon 키로 PostgREST 를 통해 테스트 코드 전문이 그대로 읽힌다.
ALTER TABLE "public"."components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."test_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."test_file_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."test_runs" ENABLE ROW LEVEL SECURITY;
