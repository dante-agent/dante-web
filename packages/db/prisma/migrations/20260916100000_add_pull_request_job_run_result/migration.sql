-- AlterTable
ALTER TABLE "pull_request_jobs" ADD COLUMN     "run_logs" TEXT,
ADD COLUMN     "run_result" JSONB;
