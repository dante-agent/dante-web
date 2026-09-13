"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// 설정 왼쪽 열의 링크 목록. 계정 설정과 프로젝트 설정이 같은 컴포넌트를 쓴다.
//
// 폴더·추천 섹션의 SubSidebar(fixed 서브 레일)를 재사용하지 않는 이유: 설정은
// 항목이 서너 개뿐이라 접을 이유가 없고, 아이콘 레일 + 고정 서브 레일 + 본문으로
// 3단이 되면 본문 폭이 남지 않는다. 그래서 이 nav 는 fixed 가 아니라 본문 안의
// 한 열이다 — 계정 설정과 프로젝트 설정 어느 쪽 레일 옆에서도 그대로 쓸 수 있다.

export type SettingsNavItem = {
  href: string;
  label: string;
};

export function SettingsNav({
  items,
  replace,
}: {
  items: SettingsNavItem[];
  /** 탭 이동을 히스토리에 쌓지 않는다. 뒤로가기가 탭이 아니라 들어온 페이지로 가게. */
  replace?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="mt-5 flex flex-col gap-0.5">
      {items.map(({ href, label }) => {
        // 정확히 일치로 본다. startsWith 면 목록의 첫 항목이 아래 모든 경로에 걸린다.
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            replace={replace}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-ml-2.5 rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors duration-[180ms] ease-out",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
