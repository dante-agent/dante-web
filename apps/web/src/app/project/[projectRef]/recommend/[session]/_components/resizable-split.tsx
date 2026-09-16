"use client";

import { useRef, useState, type ReactNode } from "react";

// 좌우 2-pane 을 드래그로 폭 조절. file-view.tsx 의 리사이저 패턴을 그대로 쓴다
// (role="separator" 핸들 + pointer capture + leftPct 20~80% 클램프). 새 의존성 없음.
// 페이지가 서버 컴포넌트라 상태(useState)를 여기 클라이언트 컴포넌트로 분리한다.
//
// 부모 체인(recommend/layout.tsx 의 SubSidebar)엔 패딩이 없고 margin-left 만 준다 —
// 상쇄할 p-8 이 없으므로 음수 마진을 넣지 않는다. 예전엔 있었는데(SubSidebar 도입 전
// 공유 p-8 셸 아래였던 시절 흔적), 지금 넣으면 헤더(z-40)·서브 사이드바(z-20) 밑으로
// 콘텐츠가 파고들어 상단·좌측이 가려진다.
export function ResizableSplit({ left, right }: { left: ReactNode; right: ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(50);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    // 드래그가 패널 밖으로 나가도 이어지도록 포인터를 캡처한다.
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !gridRef.current) return;
    const r = gridRef.current.getBoundingClientRect();
    setLeftPct(Math.min(80, Math.max(20, ((e.clientX - r.left) / r.width) * 100)));
  };

  return (
    <div
      ref={gridRef}
      className="relative grid h-[calc(100svh-47px)]"
      style={{ gridTemplateColumns: `minmax(0, ${leftPct}%) minmax(0, ${100 - leftPct}%)` }}
    >
      <div className="flex h-full min-w-0 overflow-hidden">{left}</div>
      <div className="flex h-full min-w-0 overflow-hidden">{right}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPct)}
        aria-valuemin={20}
        aria-valuemax={80}
        onPointerDown={onDown}
        onPointerMove={onMove}
        style={{ left: `${leftPct}%` }}
        className="group absolute inset-y-0 z-10 flex w-2 -translate-x-1/2 cursor-col-resize touch-none justify-center"
      >
        <span className="group-hover:bg-brand-orange/70 h-full w-0.5 rounded-full bg-transparent transition-colors" />
      </div>
    </div>
  );
}
