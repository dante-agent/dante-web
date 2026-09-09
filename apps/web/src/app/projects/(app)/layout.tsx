import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { ProductQuote, SplitShell } from "@/components/layout/split-shell";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";

// 프로젝트 목록. 로그인 화면과 같은 분할 셸을 쓴다 — 로그인 → 목록 → 온보딩이
// 껍데기 하나로 이어진다. 상단 헤더는 없앴고, 계정 정보와 로그아웃은 왼쪽 아래로
// 내렸다 (로그인 화면이 약관을 두는 자리).
export default async function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  const user = await requireUser();

  // GitHub 프로바이더가 채워주는 값. 계정에 따라 비어 있을 수 있어 순서대로 폴백한다.
  const displayName =
    (user.user_metadata.user_name as string | undefined) ??
    (user.user_metadata.full_name as string | undefined) ??
    user.email ??
    "Account";

  return (
    <SplitShell
      aside={<ProductQuote />}
      footer={
        <div className="flex items-center justify-between gap-4">
          {/* 계정 설정으로 들어가는 유일한 입구. 프로젝트 셸 헤더는 아직 비어
              있어서, 로그인 이름이 붙어 있는 이 자리가 제일 자연스럽다. */}
          <Link
            href="/account/settings/general"
            className="text-muted-foreground hover:text-foreground font-mono text-xs underline-offset-4 transition-colors duration-[180ms] ease-out hover:underline"
          >
            {displayName}
          </Link>
          {/* 서버 액션이라 <form> 이 필요하다. Base UI Button 은 기본 type 이 button
              이라 submit 을 명시하지 않으면 폼이 제출되지 않는다. */}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      {children}
    </SplitShell>
  );
}
