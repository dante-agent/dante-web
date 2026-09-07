import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";

// 계정 스코프 셸. /projects · /projects/new 가 공유한다.
// 프로젝트 스코프(/project/<ref>/...)와 달리 사이드바가 없고 상단바만 있다.
//
// TODO(다음 PR): 세션에서 사용자를 읽어 아바타·계정 메뉴(로그아웃) 렌더.
export default function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/projects" className="flex items-center gap-2.5 text-sm font-semibold">
            {/* 로그인 화면과 같은 이유로 alt 는 비운다 — 옆에 "Dante" 텍스트가 있다. */}
            <Image src={danteLogo} alt="" priority draggable={false} className="h-6 w-4.5" />
            Dante
          </Link>
          {/* 자리만 잡아둔 아바타. 세션 붙기 전까지 이니셜 placeholder. */}
          <div
            aria-hidden="true"
            className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-medium"
          >
            S
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
