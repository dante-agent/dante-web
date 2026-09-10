"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// 폴더 보기 / AI 추천 섹션의 서브 사이드바 셸.
// 메인 레일과 같은 패턴: fixed(콘텐츠 위로 덮음), left-14(접힌 레일 폭만큼 띄움). z-20 < 레일 z-30.
//
// 토글 버튼 (배경·보더 없이 아이콘만):
//  - 펼침(w-60): 패널 내부 우상단 (absolute top-2 right-2)
//  - 접힘(w-12): 배경·보더 없이 폭만 확보 — 펼치기 버튼이 그 안에 들어 본문 위로 뜨지 않는다
//  두 위치 모두 뷰포트 Y 중심 74px = 메인 레일 첫 아이템과 동일 → 세로 시프트 없음, 가로만 이동
//  콘텐츠는 ml-60 / ml-12 로 레일 폭만큼 비켜둔다 (레일↔콘텐츠 간격 32px 동일)

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
          "fixed top-12 bottom-0 left-14 z-20 overflow-hidden transition-[width] duration-200",
          // 접힘: 폭만 잡아두고 배경·보더 없이 버튼만 보인다
          collapsed ? "w-12" : "border-sidebar-border bg-sidebar w-60 border-r"
        )}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center pt-2">
            <button
              type="button"
              onClick={toggle}
              aria-label="서브 사이드바 펼치기"
              className={BTN}
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex h-full w-60 flex-col p-3">
            <button
              type="button"
              onClick={toggle}
              aria-label="서브 사이드바 접기"
              className={cn(BTN, "absolute top-2 right-1")}
            >
              <PanelLeftClose className="size-4" />
            </button>
            {nav}
          </div>
        )}
      </aside>

      <div className={cn("transition-[margin] duration-200", collapsed ? "ml-12" : "ml-60")}>
        {children}
      </div>
    </>
  );
}
