-- 프로젝트와 GitHub 설치의 team_id 를 NOT NULL 로 바꾼다.
--
-- 새 행은 #86 부터 team_id 를 같이 쓰고, 비어 있던 행은 20260914090000_backfill_team_ids 가
-- 채웠다. 그래도 NOT NULL 은 한 행만 비어도 실패하므로, 같은 재채움을 한 번 더 돌린 뒤에
-- 건다. 이미 채워진 행은 건드리지 않는다.

INSERT INTO "teams" ("id", "name", "personal_for_user_id", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    COALESCE(NULLIF(u."github_login", ''), NULLIF(split_part(u."email", '@', 1), ''), 'User'),
    u."id",
    u."created_at",
    CURRENT_TIMESTAMP
FROM "users" u
ON CONFLICT ("personal_for_user_id") DO NOTHING;

INSERT INTO "team_members" ("team_id", "user_id", "role", "created_at")
SELECT t."id", t."personal_for_user_id", 'owner', t."created_at"
FROM "teams" t
WHERE t."personal_for_user_id" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "projects" p
SET "team_id" = t."id"
FROM "teams" t
WHERE t."personal_for_user_id" = p."user_id" AND p."team_id" IS NULL;

UPDATE "github_installations" i
SET "team_id" = t."id"
FROM "teams" t
WHERE t."personal_for_user_id" = i."user_id" AND i."team_id" IS NULL;

-- AlterTable
ALTER TABLE "github_installations" ALTER COLUMN "team_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "team_id" SET NOT NULL;
