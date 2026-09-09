-- 모든 테이블 RLS ON, 정책 없음 (AGENTS.md).
--
-- 왜 필요한가: Supabase 는 public 스키마의 테이블을 PostgREST 로 자동 노출한다.
-- anon 키는 NEXT_PUBLIC_ 으로 브라우저에 그대로 나가는 공개값이라, RLS 가 꺼져
-- 있으면 누구나 이 테이블들을 REST 로 읽고 쓸 수 있다(user_api_keys 포함).
--
-- 정책(policy)을 하나도 만들지 않는 이유: RLS 가 켜져 있고 정책이 없으면 기본이
-- "전부 거부"다. 우리 앱은 DB 에 Prisma 로만 붙고(테이블 소유자 postgres 역할),
-- 소유자는 RLS 를 우회하므로 서버 코드는 영향을 받지 않는다.
-- 권한 검사(내 프로젝트가 맞는지)는 앱 코드에서 한다.

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."github_installations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;

-- _prisma_migrations 는 여기서 건드리지 않는다. 마이그레이션을 재생하는 shadow DB
-- 에는 이 테이블이 없어서 ALTER 가 실패한다. 필요하면 Supabase SQL Editor 에서 따로.
