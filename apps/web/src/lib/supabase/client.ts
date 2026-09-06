import { createBrowserClient } from "@supabase/ssr";

// 브라우저(클라이언트 컴포넌트)용. anon 키만 사용 — RLS는 켜져 있고 정책이 없어 아무것도 안 읽힌다.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
