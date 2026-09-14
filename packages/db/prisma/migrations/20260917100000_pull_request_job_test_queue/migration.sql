-- AlterTable
ALTER TABLE "pull_request_jobs" ADD COLUMN     "run_input" JSONB,
ADD COLUMN     "run_started_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pull_request_jobs_status_idx" ON "pull_request_jobs"("status");
