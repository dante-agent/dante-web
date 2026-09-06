import { createClient } from "@supabase/supabase-js";

// service_role 키 — RLS 우회. 서버 전용, 절대 클라이언트로 새어나가면 안 된다.
// 문서 규칙: DB 접근은 전부 서버에서, 권한 검사(팀 멤버 여부)는 앱 코드에서.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
