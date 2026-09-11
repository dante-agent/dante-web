-- 익스텐션 로그인 (dante-extension 결정 D-6).
--
--   extension_auth_codes  동의 화면에서 만든 1회용 code. 토큰과 바꾸는 순간 지운다
--   extension_tokens      익스텐션이 /api/v1 을 부를 때 쓰는 토큰. 해시만 저장

-- CreateTable
CREATE TABLE "extension_auth_codes" (
    "code_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "editor" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_auth_codes_pkey" PRIMARY KEY ("code_hash")
);

-- CreateTable
CREATE TABLE "extension_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "editor" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extension_auth_codes_user_id_idx" ON "extension_auth_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_tokens_token_hash_key" ON "extension_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "extension_tokens_user_id_idx" ON "extension_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "extension_auth_codes" ADD CONSTRAINT "extension_auth_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

