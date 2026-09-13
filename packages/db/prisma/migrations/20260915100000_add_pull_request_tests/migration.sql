-- CreateTable
CREATE TABLE "pull_request_tests" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "test_path" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "framework" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_request_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pull_request_tests_project_id_idx" ON "pull_request_tests"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_tests_job_id_test_path_key" ON "pull_request_tests"("job_id", "test_path");

-- AddForeignKey
ALTER TABLE "pull_request_tests" ADD CONSTRAINT "pull_request_tests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "pull_request_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_tests" ADD CONSTRAINT "pull_request_tests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- EnableRLS (Prisma cannot express this in schema.prisma)
ALTER TABLE "public"."pull_request_tests" ENABLE ROW LEVEL SECURITY;
