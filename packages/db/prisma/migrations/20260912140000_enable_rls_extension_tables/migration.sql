-- 익스텐션 테이블 2개에 RLS 를 켠다. 20260912120000_extension_auth 에서 빠졌다.
--
-- 왜 급한가: Supabase 는 public 스키마의 테이블을 PostgREST 로 자동 노출한다.
-- anon 키는 NEXT_PUBLIC_ 으로 브라우저에 그대로 나가는 공개값이라, RLS 가 꺼져
-- 있으면 누구나 이 두 표를 REST 로 읽을 수 있었다. 들어 있는 값이 특히 나쁘다:
--
--   extension_tokens.token_hash        익스텐션이 /api/v1 을 부를 때 쓰는 토큰의 해시
--   extension_auth_codes.code_hash     로그인 중간 단계 1회용 code 의 해시
--   extension_auth_codes.code_challenge  PKCE challenge
--
-- 해시라서 원문을 바로 쓸 수는 없지만, 누가 어떤 에디터를 언제 연결했는지와
-- 만료 시각이 그대로 읽힌다. user_id 도 함께 나가서 사용자 단위로 묶인다.
--
-- 정책(policy)을 만들지 않는 이유는 20260908141613_enable_rls 와 같다: RLS 가
-- 켜져 있고 정책이 없으면 기본이 전부 거부다. 우리 앱은 Prisma 로만 붙고(테이블
-- 소유자 역할), 소유자는 RLS 를 우회하므로 서버 코드는 영향을 받지 않는다.
-- 실제로 이 두 표를 읽는 곳은 lib/extension/auth.ts · account/settings 뿐이고
-- 전부 Prisma 다 — supabase-js 로 접근하는 경로는 없다.
--
-- RLS 는 Prisma 스키마로 표현할 수 없어 이 파일은 손으로 쓴다.

ALTER TABLE "public"."extension_auth_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."extension_tokens" ENABLE ROW LEVEL SECURITY;
