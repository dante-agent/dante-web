-- 프로바이더 프로필 이미지 URL 미러.
-- 로그인마다 syncUser 가 최신 값으로 덮는다 (apps/web/src/lib/auth/user.ts).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT;
