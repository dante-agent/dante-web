-- 웹훅이 채울 "연결 끊김" 표시.
-- 설치 단위(정지·삭제)와 레포 단위(설치에서 빠짐·레포 삭제)를 각자 제자리에 적는다.

-- AlterTable
ALTER TABLE "github_installations" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "disconnected_at" TIMESTAMP(3),
ADD COLUMN     "disconnected_reason" TEXT;
