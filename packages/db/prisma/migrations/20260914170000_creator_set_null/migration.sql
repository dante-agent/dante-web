-- 프로젝트·GitHub 설치의 user_id 를 "만든 사람" 기록으로 바꾼다.
--
-- 주인은 team_id 다. user_id 가 NOT NULL + ON DELETE CASCADE 로 남아 있으면, 공유 팀의
-- 프로젝트를 만든 사람이 계정을 지울 때 그 팀의 프로젝트와 설치가 같이 지워진다.
-- nullable + ON DELETE SET NULL 로 바꿔 기록만 비워지게 한다.
--
-- 컬럼 이름은 바꾸지 않는다. 옛 코드(user_id 에 값을 쓰는)와 새 코드가 둘 다 이 스키마에서
-- 동작하므로, 머지 전후 어느 쪽에 적용해도 된다.

-- DropForeignKey
ALTER TABLE "github_installations" DROP CONSTRAINT "github_installations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_fkey";

-- AlterTable
ALTER TABLE "github_installations" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
