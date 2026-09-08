"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// 폴더 보기 / AI 추천 섹션의 서브 사이드바 셸.
// 메인 레일과 같은 패턴: fixed(콘텐츠 위로 덮음), left-14(접힌 레일 폭만큼 띄움),
// 콘텐츠는 ml-60(= aside 폭)으로 비켜둔다. z-20 < 레일 z-30.
//
// 토글 버튼 (배경·보더 없이 아이콘만):
//  - 펼침: 패널 내부 우상단
//  - 접힘: 패널은 w-0 로 사라지고 아이콘만 top-14 left-14 자리에 남는다
//  두 위치 모두 Y 중심 74px = 레일 첫 아이콘과 동일 → 세로 시프트 없음, 가로만 이동

// 클릭 영역 36x40. 호버 시 배경 없이 아이콘 색만.
const BTN =
  "text-sidebar-foreground/70 hover:text-sidebar-foreground grid h-9 w-10 place-items-center transition-colors";

export function SubSidebar({ nav, children }: { nav?: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => setCollapsed((c) => !c);

  return (
    <>
      <aside
        className={cn(
          "border-sidebar-border bg-sidebar fixed top-12 bottom-0 left-14 z-20 overflow-hidden border-r transition-[width] duration-200",
          collapsed ? "w-0 border-r-0" : "w-60"
        )}
      >
        <div className="relative w-60 p-3">
          <button
            type="button"
            onClick={toggle}
            aria-label="서브 사이드바 접기"
            className={cn(BTN, "absolute top-2 right-2")}
          >
            <PanelLeftClose className="size-4" />
          </button>
          {nav}
        </div>
      </aside>

      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="서브 사이드바 펼치기"
          className={cn(BTN, "fixed top-14 left-14 z-20")}
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      <div className={cn("transition-[margin] duration-200", collapsed ? "ml-0" : "ml-60")}>
        {children}
      </div>
    </>
  );
}
