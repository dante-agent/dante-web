"use client";

// 메인 사이드바 — 프로젝트 셸의 왼쪽 아이콘 레일.
// 펼침/접힘은 순수 CSS(hover / focus-within + width transition). 토글 버튼·상태 없음.
// 접힘: 아이콘만(w-14) / 펼침: 아이콘 + 텍스트(w-56). 콘텐츠를 밀지 않고 위로 덮는다(fixed + z-30).
// 클라 코드는 활성 표시(usePathname)뿐. 서브 사이드바는 섹션별 중첩 layout 이 담당한다.

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { LayoutDashboard, Folder, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { key: "folder", label: "Explorer", Icon: Folder },
  { key: "recommend", label: "AI Recommendations", Icon: Sparkles },
  { key: "settings", label: "Settings", Icon: Settings },
] as const;

export function ProjectSidebar() {
  const { projectRef } = useParams<{ projectRef: string }>();
  const pathname = usePathname();

  return (
    <aside className="group/rail bg-sidebar border-sidebar-border fixed top-[47px] bottom-0 left-0 z-30 flex w-14 flex-col gap-1 overflow-hidden border-r p-2 transition-[width] duration-200 hover:w-56 has-[:focus-visible]:w-56">
      {ITEMS.map(({ key, label, Icon }) => {
        const href = `/project/${projectRef}/${key}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm whitespace-nowrap",
              active
                ? "bg-sidebar-accent text-sidebar-primary" // DESIGN.md: 활성 = 브랜드 오렌지 (아이콘도 currentColor)
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {/* hidden 이 아니라 opacity — a11y 트리에 남겨 스크린리더가 읽게 한다 */}
            <span className="opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100">
              {label}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
