"use client";

// 왼쪽 아이콘 레일의 껍데기. 프로젝트 셸과 계정 셸이 같은 레일을 쓴다.
//
// 계정 화면이 레일 없이 따로 놀면 프로젝트 → 계정 설정으로 넘어갈 때 본문이
// 56px 왼쪽으로 튀었다. 항목은 달라도 레일 자체는 늘 같은 자리에 있어야 한다.
//
// 펼침/접힘은 순수 CSS(hover / focus-within + width transition). 토글 버튼·상태 없음.
// 접힘: 아이콘만(w-14) / 펼침: 아이콘 + 텍스트(w-56). 콘텐츠를 밀지 않고 위로 덮는다(fixed + z-30).

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RailItem = { href: string; label: string; Icon: LucideIcon };

export function SidebarRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="group/rail bg-sidebar border-sidebar-border fixed top-[47px] bottom-0 left-0 z-30 flex w-14 flex-col gap-1 overflow-hidden border-r p-2 transition-[width] duration-200 hover:w-56 has-[:focus-visible]:w-56">
      {items.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
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
