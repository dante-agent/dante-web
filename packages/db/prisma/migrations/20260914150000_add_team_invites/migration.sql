-- 팀 초대. 링크 토큰은 해시만 두고, 수락하면 행을 지운다(1회용).

-- CreateTable
CREATE TABLE "team_invites" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_token_hash_key" ON "team_invites"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_team_id_email_key" ON "team_invites"("team_id", "email");

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: 정책 없이 켠다. 이 표는 서버(Prisma)만 읽는다 (apps/web/AGENTS.md).
ALTER TABLE "public"."team_invites" ENABLE ROW LEVEL SECURITY;
