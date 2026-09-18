"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

// 폴더 보기 / AI 추천 섹션의 서브 사이드바 셸.
// 메인 레일과 같은 패턴: fixed(콘텐츠 위로 덮음), left-14(접힌 레일 폭만큼 띄움). z-20 < 레일 z-30.
//
// 접기/펼치기 버튼 자리:
//   펼침 → 사이드바 안 오른쪽 위 (지금 보고 있는 것을 닫는 버튼은 그 안에 있는 게 맞다)
//   접힘 → 버튼 없음. 폭이 0 이라 본문이 화면 끝까지 간다. 다시 펼치는 건 메인 레일의
//          섹션 아이콘 재클릭 (SidebarRail `togglesSubSidebar`) — 이 사이드바를 연 바로 그
//          아이콘이다. 새 버튼을 어디 띄우는 대신 이미 있는 걸 재활용한다.
//   단축키 → ⌘B / Ctrl+B (VS Code 의 사이드바 토글과 같은 키). 서브 사이드바가 있는 섹션에서만 동작.

// 접힘 상태는 모듈 스코프 store. 서브 사이드바(섹션 layout)와 메인 레일(프로젝트 layout)이
// 서로 다른 트리에 있어 공통 provider 를 둘 자리가 없고, 화면에 하나뿐이라 전역이 맞다.
let collapsed = false;
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** 레일 아이콘 재클릭 / 사이드바 내부 접기 버튼이 같이 쓴다. */
export function toggleSubSidebar() {
  collapsed = !collapsed;
  for (const l of listeners) l();
}

/** 접혀 있나. 레일이 아이콘에 힌트를 붙일 때도 쓴다. */
export function useSubSidebarCollapsed() {
  return useSyncExternalStore(
    subscribe,
    () => collapsed,
    () => false // SSR 은 늘 펼친 상태로 그린다
  );
}

export function SubSidebar({ nav, children }: { nav?: ReactNode; children: ReactNode }) {
  const isCollapsed = useSubSidebarCollapsed();

  // 서브 사이드바는 한 화면에 하나라 리스너도 하나. capture 단계로 받아
  // Monaco 같은 에디터가 먼저 키를 삼켜도 토글되게 한다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.repeat) return;
      if (e.key.toLowerCase() !== "b") return;
      e.preventDefault();
      toggleSubSidebar();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <>
      <aside
        // 접히면 폭 0 — 안쪽 링크로 탭 이동이 들어가지 않게 inert.
        inert={isCollapsed}
        className={cn(
          "fixed top-[47px] bottom-0 left-14 z-20 overflow-hidden transition-[width] duration-200",
          isCollapsed ? "w-0" : "border-sidebar-border bg-sidebar w-60 border-r"
        )}
      >
        {/* 폭 고정 — 바깥 aside 가 접히는 동안 내용이 찌그러지지 않게. */}
        <div className="relative flex h-full w-60 flex-col p-3">
          <button
            type="button"
            onClick={toggleSubSidebar}
            title="Collapse sub sidebar (⌘B)"
            aria-label="Collapse sub sidebar"
            aria-expanded
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground absolute top-2 right-1 grid h-9 w-10 place-items-center transition-colors"
          >
            <PanelLeftClose className="size-4" />
          </button>
          {nav}
        </div>
      </aside>

      <div className={cn("transition-[margin] duration-200", isCollapsed ? "ml-0" : "ml-60")}>
        {children}
      </div>
    </>
  );
}
