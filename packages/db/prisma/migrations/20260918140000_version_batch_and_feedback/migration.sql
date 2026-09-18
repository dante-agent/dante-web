-- 배치 생성 묶음(batch_id)과 결과 피드백(feedback)을 테스트 버전에 더한다. 둘 다 추가만, 비파괴.

-- AlterTable
ALTER TABLE "test_file_versions" ADD COLUMN "batch_id" UUID;
ALTER TABLE "test_file_versions" ADD COLUMN "feedback" TEXT;
