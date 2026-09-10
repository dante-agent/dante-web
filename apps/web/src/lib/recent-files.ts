// "최근 본 파일" — projectRef 별 localStorage, MRU 최대 6. localStorage 는 프라이빗 모드 등에서 throw → 전부 try/catch.
// 여러 컴포넌트가 읽고 한쪽이 바꾸므로 useSyncExternalStore 로 공유한다 (useRecent).

import { useSyncExternalStore } from "react";

const MAX = 6;
const storageKey = (projectRef: string) => `dante:recent:${projectRef}`;

const listeners = new Set<() => void>();
let cacheRef: string | null = null;
let cache: string[] = [];

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  cacheRef = null;
  for (const l of listeners) l();
}

function read(projectRef: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(projectRef));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 안정적인 참조를 돌려준다(같은 상태면 같은 배열). useSyncExternalStore 의 getSnapshot 용. */
export function getRecent(projectRef: string): string[] {
  if (cacheRef !== projectRef) {
    cacheRef = projectRef;
    cache = read(projectRef);
  }
  return cache;
}

export function useRecent(projectRef: string): string[] {
  return useSyncExternalStore(
    subscribe,
    () => getRecent(projectRef),
    () => cache
  );
}

export function pushRecent(projectRef: string, path: string): void {
  try {
    const next = [path, ...read(projectRef).filter((p) => p !== path)].slice(0, MAX);
    localStorage.setItem(storageKey(projectRef), JSON.stringify(next));
  } catch {
    /* 무시 */
  }
  emit();
}

export function clearRecent(projectRef: string): void {
  try {
    localStorage.removeItem(storageKey(projectRef));
  } catch {
    /* 무시 */
  }
  emit();
}
