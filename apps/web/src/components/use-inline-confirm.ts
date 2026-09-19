"use client";

// "Remove → Cancel / Remove" 처럼 버튼이 제자리에서 확인 버튼으로 바뀌는 인라인 확인.
// 누른 버튼이 DOM 에서 빠지면 포커스가 body 로 떨어져, 키보드 사용자는 처음부터 다시 Tab 해야 한다.
// 확인 모드로 들어가면 확정 버튼으로, 취소하면 원래 버튼으로 포커스를 옮긴다.

import { useEffect, useRef, useState } from "react";

export function useInlineConfirm() {
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // 사용자가 바꿨을 때만 옮긴다. 첫 렌더에 포커스를 가져가면 안 된다.
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    (confirming ? confirmRef : triggerRef).current?.focus();
  }, [confirming]);

  const set = (next: boolean) => {
    moved.current = true;
    setConfirming(next);
  };

  return {
    confirming,
    start: () => set(true),
    cancel: () => set(false),
    triggerRef,
    confirmRef,
  };
}
