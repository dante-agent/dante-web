"use client";

import { useEffect, useRef } from "react";
import { takeArrivalFocus } from "@/components/generation/arrival-focus";

/**
 * 세션 제목. 생성이 끝나 이 화면으로 넘어왔을 때만 포커스를 받는다(arrival-focus.ts) —
 * 스크린리더가 새 화면의 제목부터 읽고, Tab 도 여기서 이어진다.
 * 세션을 옮겨도 이 컴포넌트는 그대로 남을 수 있어서 sessionId 가 바뀔 때마다 확인한다.
 */
export function SessionTitle({ sessionId, title }: { sessionId: string; title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeArrivalFocus()) ref.current?.focus();
  }, [sessionId]);
  return (
    <h1 ref={ref} tabIndex={-1} className="truncate text-sm font-semibold outline-none">
      {title}
    </h1>
  );
}
