"use client";

import { useRef, useState, type ReactNode } from "react";

// 위(코드)·아래(터미널) 2-pane 을 드래그로 높이 조절한다 — ResizableSplit(좌우)의 세로 버전.
// 구분선은 가운데 세로 구분선과 같은 인터랙션: hover 하면 색이 들어오고, 잡고 끌면 높이가 바뀐다.
//
// 아래 pane(터미널)은 헤더(Run 버튼 줄)만 남을 때까지 내릴 수 있게 최소 높이를 그 헤더 높이로 둔다.
// 위 pane(코드)은 항상 일정 높이(minTopPx) 이상 남겨, 코드가 넘치면 그 안에서 스크롤되게 한다.
export function VerticalSplit({
  top,
  bottom,
  minBottomPx = 40,
  minTopPx = 96,
  initialBottomPx = 256,
}: {
  top: ReactNode;
  bottom: ReactNode;
  /** 아래 pane 최소 높이 = 터미널 헤더(Run 버튼 줄) 높이. */
  minBottomPx?: number;
  /** 위 pane(코드)에 남길 최소 높이. */
  minTopPx?: number;
  initialBottomPx?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bottomPx, setBottomPx] = useState(initialBottomPx);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    // 드래그가 pane 밖으로 나가도 이어지도록 포인터를 캡처한다.
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // 커서에서 컨테이너 하단까지가 아래 pane 높이. 위/아래 최소치로 클램프한다.
    const next = rect.bottom - e.clientY;
    const max = Math.max(minBottomPx, rect.height - minTopPx);
    setBottomPx(Math.min(Math.max(minBottomPx, next), max));
  };

  return (
    <div
      ref={containerRef}
      className="relative grid h-full w-full min-w-0"
      style={{ gridTemplateRows: `minmax(0, 1fr) ${bottomPx}px` }}
    >
      {/* flex 래퍼라 자식(CodePanel/TestRunPanel)이 pane 높이를 꽉 채운다 — 그래야 내부 overflow 스크롤이 산다. */}
      <div className="flex min-h-0 overflow-hidden">{top}</div>
      <div className="flex min-h-0 overflow-hidden">{bottom}</div>

      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onDown}
        onPointerMove={onMove}
        style={{ bottom: `${bottomPx}px` }}
        className="group absolute inset-x-0 z-10 flex h-2 -translate-y-1/2 cursor-row-resize touch-none items-center justify-center"
      >
        {/* 쉬는 상태에도 은은한 선(bg-border), hover 하면 색이 들어온다. */}
        <span className="bg-border group-hover:bg-brand-orange/70 h-px w-full transition-colors" />
        {/* 가운데 손잡이 — 여기가 드래그로 조절되는 구분선임을 알려준다. */}
        <span className="bg-border group-hover:bg-brand-orange/70 absolute h-1 w-10 rounded-full transition-colors" />
      </div>
    </div>
  );
}
