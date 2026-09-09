import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// 계정 스코프 셸. /account/... 는 프로젝트 밖이라 프로젝트 아이콘 레일이 없다.
//
// 레일을 지운 대신 헤더에 나가는 문을 둔다. 프로젝트 셸의 헤더는 아직 비어
// 있는데, 거기는 왼쪽 레일이 항상 길을 알려주지만 여기는 그게 없기 때문이다.
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="min-h-svh pt-12">
      <header className="bg-sidebar border-sidebar-border fixed inset-x-0 top-0 z-40 flex h-12 items-center border-b px-4">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] transition-colors duration-[180ms] ease-out"
        >
          <ArrowLeft className="size-3.5" />
          Projects
        </Link>
      </header>

      <main className="p-8">{children}</main>
    </div>
  );
}
