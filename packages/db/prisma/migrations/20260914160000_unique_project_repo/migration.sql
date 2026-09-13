-- 레포 하나는 Dante 전체에서 프로젝트 하나다(팀 모델 결정 5).
--
-- 사용자 단위 unique(user_id, repo_id)를 전역 unique(repo_id)로 바꾼다. 적용 전에 운영 DB 의
-- 중복을 확인했다(2026-09-13, 프로젝트 5건·레포 5개, 중복 0). 중복이 있으면 아래 CREATE 가
-- 실패하고 트랜잭션째 되돌아가므로, 옛 제약만 사라진 채로 남지 않는다.

-- DropIndex
DROP INDEX "projects_user_id_repo_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "projects_repo_id_key" ON "projects"("repo_id");
