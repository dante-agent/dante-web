-- 팀에 붙인 Slack 워크스페이스. 봇 토큰은 암호화해 둔다(apps/web/src/lib/crypto/secret.ts).

-- CreateTable
CREATE TABLE "slack_installations" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "slack_team_name" TEXT NOT NULL,
    "bot_user_id" TEXT NOT NULL,
    "encrypted_bot_token" TEXT NOT NULL,
    "scopes" TEXT[],
    "installed_by_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_installations_team_id_key" ON "slack_installations"("team_id");

-- AddForeignKey
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_installed_by_id_fkey" FOREIGN KEY ("installed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: 정책 없이 켠다. 이 표는 서버(Prisma)만 읽는다 (apps/web/AGENTS.md).
ALTER TABLE "public"."slack_installations" ENABLE ROW LEVEL SECURITY;
