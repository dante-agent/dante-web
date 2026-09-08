import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";

// 계정 스코프 셸. /projects · /projects/new 가 공유한다.
//
// 치수는 Supabase 대시보드 실측값이다.
//   상단바 48px · 콘텐츠 컬럼 max-w 768px + 좌우 40px (본문 폭 688px) · 상단 여백 48px
//
export default async function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  const user = await requireUser();

  // GitHub 프로바이더가 채워주는 값. 계정에 따라 비어 있을 수 있어 순서대로 폴백한다.
  const displayName =
    (user.user_metadata.user_name as string | undefined) ??
    (user.user_metadata.full_name as string | undefined) ??
    user.email ??
    "계정";

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border sticky top-0 z-10 h-12 border-b backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-5">
          <Link href="/projects" className="flex items-center gap-2 text-[13px] font-semibold">
            {/* 로그인 화면과 같은 이유로 alt 는 비운다 — 옆에 "Dante" 텍스트가 있다. */}
            <Image src={danteLogo} alt="" priority draggable={false} className="h-5 w-[15px]" />
            Dante
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground font-mono text-xs">{displayName}</span>
            {/* 서버 액션이라 <form> 이 필요하다. Base UI Button 은 기본 type 이 button 이라
                submit 을 명시하지 않으면 폼이 제출되지 않는다. */}
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                로그아웃
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-10 pt-12 pb-16">{children}</main>
    </div>
  );
}
