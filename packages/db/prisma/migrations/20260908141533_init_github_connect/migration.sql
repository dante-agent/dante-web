-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "github_login" TEXT,
    "github_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_installations" (
    "id" BIGINT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "account_type" TEXT NOT NULL,
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo_id" BIGINT NOT NULL,
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT true,
    "test_framework" TEXT,
    "setup_completed_at" TIMESTAMP(3),
    "user_id" UUID NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_api_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "last_four" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_installations_user_id_idx" ON "github_installations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_ref_key" ON "projects"("ref");

-- CreateIndex
CREATE INDEX "projects_installation_id_idx" ON "projects"("installation_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_user_id_repo_id_key" ON "projects"("user_id", "repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_api_keys_user_id_provider_key" ON "user_api_keys"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "github_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
