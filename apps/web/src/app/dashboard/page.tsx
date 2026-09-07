import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

// 로그인이 실제로 됐는지 눈으로 확인하는 임시 페이지. 진짜 대시보드는 나중에.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-medium tracking-tight">로그인됨</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">{user.email}</p>
      </div>

      <form action={signOut}>
        <Button type="submit" variant="outline" size="lg">
          로그아웃
        </Button>
      </form>
    </main>
  );
}
