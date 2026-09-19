"use client";

// 왼쪽 아이콘 레일의 껍데기. 프로젝트 셸과 계정 셸이 같은 레일을 쓴다.
//
// 계정 화면이 레일 없이 따로 놀면 프로젝트 → 계정 설정으로 넘어갈 때 본문이
// 56px 왼쪽으로 튀었다. 항목은 달라도 레일 자체는 늘 같은 자리에 있어야 한다.
//
// 펼침/접힘은 순수 CSS(hover / focus-within + width transition). 토글 버튼·상태 없음.
// 접힘: 아이콘만(w-14) / 펼침: 아이콘 + 텍스트(w-56). 콘텐츠를 밀지 않고 위로 덮는다(fixed + z-30).
//
// 이미 그 섹션에 있는 항목(togglesSubSidebar)은 링크가 아니라 서브 사이드바 토글이 된다.
// 같은 URL 로 가는 링크는 어차피 아무 일도 안 하고, 서브 사이드바를 연 아이콘이 그걸
// 다시 닫는(여는) 자리로도 가장 자연스럽다. 접힌 서브 사이드바는 폭이 0 이라 자기 버튼을
// 둘 자리가 없다 — 그 버튼을 여기서 대신 받는다.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftOpen, type LucideIcon } from "lucide-react";
import { toggleSubSidebar, useSubSidebarCollapsed } from "@/components/sub-sidebar";
import { cn } from "@/lib/utils";

export type RailItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** 이 섹션에 서브 사이드바가 있나. 있으면 활성 상태에서 재클릭 = 접기/펼치기. */
  togglesSubSidebar?: boolean;
  /** 있으면 일반 클릭은 이걸 부르고 href 이동은 막는다. 새 탭 열기(⌘/Ctrl·휠 클릭)는 href 로. */
  onClick?: () => void;
};

export function SidebarRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname();
  const collapsed = useSubSidebarCollapsed();

  return (
    <nav
      aria-label="Main"
      className="group/rail bg-sidebar border-sidebar-border fixed top-[47px] bottom-0 left-0 z-30 flex w-14 flex-col gap-1 overflow-hidden border-r p-2 transition-[width] duration-200 hover:w-56 has-[:focus-visible]:w-56"
    >
      {items.map(({ href, label, Icon, togglesSubSidebar, onClick }) => {
        const active = pathname.startsWith(href);
        const toggles = active && togglesSubSidebar;

        const className = cn(
          "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm whitespace-nowrap",
          active
            ? "bg-sidebar-accent text-sidebar-primary" // DESIGN.md: 활성 = 브랜드 오렌지 (아이콘도 currentColor)
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        );

        const body = (
          <>
            <Icon className="size-4 shrink-0" />
            {/* hidden 이 아니라 opacity — a11y 트리에 남겨 스크린리더가 읽게 한다 */}
            <span className="opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100">
              {label}
            </span>
            {/* 접혀 있을 때만, 레일을 펼쳤을 때만 보이는 힌트 — 여기가 다시 여는 버튼이라는 표시 */}
            {toggles && collapsed && (
              <PanelLeftOpen className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-60 group-has-[:focus-visible]/rail:opacity-60" />
            )}
          </>
        );

        // 같은 섹션 재클릭 = 서브 사이드바 토글. 라우팅은 일어나지 않는다.
        return toggles ? (
          <button
            key={href}
            type="button"
            // 서브 사이드바를 접으면 포커스가 여기로 온다(sub-sidebar.tsx collapseFrom).
            data-sub-sidebar-toggle
            onClick={toggleSubSidebar}
            aria-label={collapsed ? `Expand ${label} sidebar` : `Collapse ${label} sidebar`}
            aria-expanded={!collapsed}
            aria-current="page"
            className={className}
          >
            {body}
          </button>
        ) : (
          <Link
            key={href}
            href={href}
            onClick={
              onClick &&
              ((e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onClick();
              })
            }
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
