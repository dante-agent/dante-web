-- CreateTable
CREATE TABLE "pull_request_jobs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "head_sha" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_request_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pull_request_jobs_project_id_pr_number_created_at_idx" ON "pull_request_jobs"("project_id", "pr_number", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_jobs_project_id_pr_number_head_sha_key" ON "pull_request_jobs"("project_id", "pr_number", "head_sha");

-- AddForeignKey
ALTER TABLE "pull_request_jobs" ADD CONSTRAINT "pull_request_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- EnableRLS (Prisma cannot express this in schema.prisma)
ALTER TABLE "public"."pull_request_jobs" ENABLE ROW LEVEL SECURITY;
