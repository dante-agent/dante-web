import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// 로그인 후 도착하는 화면. 아직 내용은 없고, 세션이 실제로 붙었는지 보여주는 자리다.
// TODO(다음 PR): 프로젝트 목록 / 프로젝트 스코프 라우트(/project/<ref>/...)로 연결
export default async function DashboardPage() {
  const supabase = await createClient();

  // getUser() 는 Supabase 서버에 토큰을 검증받는다.
  // getSession() 은 쿠키 내용을 그대로 믿으므로 권한 판단에 쓰면 안 된다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy 가 이미 걸러주지만, 페이지 자체로도 성립해야 한다.
  // (proxy 는 최적화용 검사라 최종 방어선이 될 수 없다 — Next.js 문서 권고)
  if (!user) redirect(LOGIN_PATH);

  // GitHub 프로바이더가 채워주는 값들. 계정에 따라 비어 있을 수 있어 순서대로 폴백한다.
  const displayName =
    (user.user_metadata.user_name as string | undefined) ??
    (user.user_metadata.full_name as string | undefined) ??
    user.email ??
    "there";

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Welcome, {displayName}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You are signed in with GitHub. The dashboard is coming next.
        </p>
      </div>

      <form action={signOut}>
        <Button variant="outline" size="lg" className="h-10">
          Sign out
        </Button>
      </form>
    </main>
  );
}
