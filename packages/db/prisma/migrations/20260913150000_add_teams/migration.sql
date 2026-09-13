-- 팀 모델 1단계: Team·TeamMember 를 추가하고 기존 데이터를 개인 팀으로 옮긴다.
-- user_id 는 지우지 않는다. 조회를 멤버십 기준으로 바꾸기 전까지 옛 코드가 그대로
-- 쓰고, 문제가 생기면 이 마이그레이션만 되돌릴 수 있게 남겨둔다.

-- CreateEnum
CREATE TYPE "team_role" AS ENUM ('owner', 'member');

-- AlterTable
ALTER TABLE "github_installations" ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "team_id" UUID;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "personal_for_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "team_role" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_personal_for_user_id_key" ON "teams"("personal_for_user_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "github_installations_team_id_idx" ON "github_installations"("team_id");

-- CreateIndex
CREATE INDEX "projects_team_id_idx" ON "projects"("team_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_personal_for_user_id_fkey" FOREIGN KEY ("personal_for_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 이관: 기존 사용자마다 개인 팀을 만들고 owner 로 넣는다.
-- 이름은 lib/auth/user.ts 의 displayName 과 같은 순서로 고른다. DB 에는 GitHub 핸들과
-- 이메일만 있어서 그 둘만 본다.
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

-- 프로젝트와 설치는 지금 주인(user_id)의 개인 팀으로 옮긴다.
UPDATE "projects" p
SET "team_id" = t."id"
FROM "teams" t
WHERE t."personal_for_user_id" = p."user_id" AND p."team_id" IS NULL;

UPDATE "github_installations" i
SET "team_id" = t."id"
FROM "teams" t
WHERE t."personal_for_user_id" = i."user_id" AND i."team_id" IS NULL;

-- RLS ON, 정책 없음 (AGENTS.md). 멤버십 표가 anon 키로 열리면 "누가 어느 팀에 있나"가
-- 그대로 새고, 쓰기까지 시도할 수 있다. 앱은 Prisma 로만 붙으므로 영향이 없다.
ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;
