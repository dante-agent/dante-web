-- team_id 를 한 번 더 채운다. 스키마는 바꾸지 않는다.
--
-- 20260913150000_add_teams 가 적용된 뒤, 새 코드가 배포되기 전까지 옛 코드가 만든
-- 사용자·설치·프로젝트는 팀이 비어 있다. 조회를 멤버십 기준으로 바꾸면(feat/team-access)
-- 이런 행은 주인에게도 보이지 않게 되므로, 그 코드와 같이 나간다.
--
-- 이미 채워진 행은 건드리지 않는다. 몇 번을 돌려도 결과가 같다.

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
