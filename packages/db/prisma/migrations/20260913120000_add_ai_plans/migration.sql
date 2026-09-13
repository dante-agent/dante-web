-- CreateTable
CREATE TABLE "ai_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_limit_usd" DECIMAL(12,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_plans_pkey" PRIMARY KEY ("id"),
    -- 음수 한도는 뜻을 알 수 없다. budget.ts 가 환경변수 음수를 거부하는 것과 같다.
    -- Prisma 스키마로 표현할 수 없어 손으로 넣었다.
    CONSTRAINT "ai_plans_monthly_limit_usd_check" CHECK ("monthly_limit_usd" >= 0)
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "ai_plan_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ai_plans_name_key" ON "ai_plans"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_ai_plan_id_fkey" FOREIGN KEY ("ai_plan_id") REFERENCES "ai_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS ON, 정책 없음 (AGENTS.md, 20260912133000_enable_rls_ai_usage 와 같은 이유).
-- 플랜 한도 자체는 비밀이 아니지만, 열어두면 anon 키로 PostgREST 를 통해 쓰기까지
-- 시도할 수 있는 표가 된다. 앱은 Prisma 로만 붙으므로 영향이 없다.
ALTER TABLE "public"."ai_plans" ENABLE ROW LEVEL SECURITY;
