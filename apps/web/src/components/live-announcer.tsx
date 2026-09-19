"use client";

// 화면 전체가 같이 쓰는 스크린리더 알림 영역.
//
// role="status" 영역은 처음부터 DOM 에 있어야 안의 글자가 바뀔 때 읽힌다. 알릴 때마다
// 조건부로 끼워 넣으면 스크린리더가 놓친다. 그래서 루트(Providers)에 하나만 두고, 어디서든
// announce("Saved") 로 글자만 바꾼다. 서브 사이드바 접힘처럼 트리가 달라 provider 를 둘
// 자리가 마땅치 않아 모듈 스코프 store 로 둔다(sub-sidebar.tsx 와 같은 방식).
//
// 오류처럼 바로 끊고 읽어야 하는 것은 여기가 아니라 그 자리의 role="alert" 가 맡는다.

import { useEffect, useSyncExternalStore } from "react";

let message = "";
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function set(next: string) {
  message = next;
  for (const listener of listeners) listener();
}

/** 스크린리더에 한 번 읽힐 문구를 보낸다. 화면에는 보이지 않는다. */
export function announce(text: string) {
  // 같은 문구("Saved")를 연달아 보내도 다시 읽히게, 한 번 비웠다가 조금 뒤에 채운다.
  clearTimeout(timer);
  set("");
  timer = setTimeout(() => set(text), 100);
}

/**
 * text 가 바뀔 때마다 알린다(빈 값은 무시). 같은 문구를 다시 알려야 하면 key 를 바꾼다 —
 * useActionState 의 state 객체처럼 제출할 때마다 새로 생기는 값을 넘기면 된다.
 */
export function useAnnounce(text: string | null | undefined, key: unknown = text) {
  useEffect(() => {
    if (text) announce(text);
  }, [text, key]);
}

/** 클립보드에 쓰고 결과("Copied" / "Copy failed")를 알린다. 성공 여부를 돌려준다. */
export async function copyAndAnnounce(text: string): Promise<boolean> {
  try {
    // http 로 열었거나 권한이 없으면 clipboard 가 없다.
    if (!navigator.clipboard) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    announce("Copied");
    return true;
  } catch {
    announce("Copy failed");
    return false;
  }
}

export function LiveAnnouncer() {
  const text = useSyncExternalStore(
    subscribe,
    () => message,
    () => ""
  );
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
