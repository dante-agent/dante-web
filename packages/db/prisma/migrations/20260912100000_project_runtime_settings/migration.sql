-- 실행 환경 설정 (설정 > Runtime). 전부 nullable — null 은 "아직 저장한 적 없음"이고
-- 읽는 쪽이 기본값으로 접는다. projects 는 이미 RLS 가 켜져 있어 따로 손대지 않는다.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "install_command" TEXT,
ADD COLUMN     "test_command" TEXT,
ADD COLUMN     "test_timeout_ms" INTEGER;
