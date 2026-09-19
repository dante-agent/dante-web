import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { FeedbackLink } from "@/components/feedback-link";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { UserMenu } from "@/components/user-menu";
import { avatarUrl, displayName, requireUser } from "@/lib/auth/user";

// 계정 스코프 셸. /account/... 는 프로젝트 밖이라 브레드크럼·검색은 없지만,
// 헤더 높이·레일 폭·본문 여백은 프로젝트 셸(project/[projectRef]/layout.tsx)과
// 똑같이 맞춘다. 안 그러면 프로젝트 → 계정 설정으로 넘어올 때 본문이 튄다.
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser();
  const headerUser = { name: displayName(user), avatarUrl: avatarUrl(user) };

  return (
    <div className="min-h-svh pt-[47px]">
      <header className="bg-sidebar border-sidebar-border fixed inset-x-0 top-0 z-40 flex h-[47px] items-center border-b pr-3">
        {/* 로고 = 레일(w-14)과 같은 열. app-header 와 같은 자리 */}
        <div className="flex h-full w-14 shrink-0 items-center pl-[18px]">
          <Link href="/projects" aria-label="Dante">
            <Image src={danteLogo} alt="" draggable={false} className="h-5 w-[15px] select-none" />
          </Link>
        </div>

        <nav aria-label="Breadcrumb" className="flex shrink-0 items-center gap-4">
          <span aria-hidden="true" className="text-muted-foreground/40 text-sm select-none">
            /
          </span>
          <span className="px-2 text-sm font-medium">Account</span>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <FeedbackLink />
          <UserMenu user={headerUser} />
        </div>
      </header>

      <AccountSidebar />
      <main id={MAIN_CONTENT_ID} className="ml-14 p-8">
        {children}
      </main>
    </div>
  );
}
