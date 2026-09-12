-- ai_usage 도 RLS ON, 정책 없음 (AGENTS.md · 20260908141613_enable_rls 와 같은 이유).
--
-- Supabase 는 public 스키마의 테이블을 PostgREST 로 자동 노출한다. anon 키는
-- NEXT_PUBLIC_ 으로 브라우저에 나가는 공개값이라, RLS 가 꺼져 있으면 누구나 이
-- 표를 REST 로 읽을 수 있다. 여기에는 "누가 언제 얼마를 썼는지"가 들어 있어서
-- 읽히면 사용자별 활동량이 그대로 노출된다.
--
-- 정책을 만들지 않는 이유도 같다: RLS 가 켜져 있고 정책이 없으면 기본이 전부
-- 거부이고, 우리 앱은 테이블 소유자 역할로 Prisma 를 통해서만 붙으므로 서버
-- 코드는 영향을 받지 않는다.
--
-- RLS 는 Prisma 스키마로 표현할 수 없어 이 파일은 손으로 쓴다.

ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;
