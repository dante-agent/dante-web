// AI 채팅 기록 — projectRef 별 localStorage, 최근 10개.
// recent-files.ts 와 같은 방식이다: localStorage 는 프라이빗 모드 등에서 throw 하므로
// 전부 try/catch 하고, 저장소가 React 밖에 있으니 useSyncExternalStore 로 읽는다.
//
// 서버에 저장하지 않는 이유: 읽고 쓰는 곳이 채팅 패널 한 군데뿐이라 테이블 하나와
// 마이그레이션을 더할 값이 아직 없다.
// ponytail: 브라우저에 묶인다(기기·브라우저 간 공유 안 됨, 캐시 지우면 사라짐).
// 공유·보존이 필요해지면 ChatSession 테이블로 옮긴다.

import { useSyncExternalStore } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Chat = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

const MAX = 10;
/** 목록에 보여줄 제목 길이. 넘으면 자른다. */
const TITLE_LENGTH = 40;
/** 서버 렌더 스냅샷. localStorage 가 없으므로 항상 빈 목록이다(참조 고정). */
const EMPTY: Chat[] = [];

const storageKey = (projectRef: string) => `dante:chats:${projectRef}`;

const listeners = new Set<() => void>();
let cacheRef: string | null = null;
let cache: Chat[] = EMPTY;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  cacheRef = null;
  for (const l of listeners) l();
}

/** 사용자가 직접 고칠 수 있는 저장소다 — 모양이 맞는 것만 통과시킨다. */
function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== "object") return false;
  const chat = value as Chat;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    typeof chat.updatedAt === "number" &&
    Array.isArray(chat.messages) &&
    chat.messages.every(
      (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    )
  );
}

function read(projectRef: string): Chat[] {
  try {
    const raw = localStorage.getItem(storageKey(projectRef));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(isChat).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return EMPTY;
  }
}

/** 안정적인 참조를 돌려준다(같은 상태면 같은 배열). useSyncExternalStore 의 getSnapshot 용. */
function getChats(projectRef: string): Chat[] {
  if (cacheRef !== projectRef) {
    cacheRef = projectRef;
    cache = read(projectRef);
  }
  return cache;
}

/** 최근 수정 순. 저장·삭제가 일어나면 다시 그린다. */
export function useChats(projectRef: string): Chat[] {
  return useSyncExternalStore(
    subscribe,
    () => getChats(projectRef),
    () => EMPTY
  );
}

function write(projectRef: string, chats: Chat[]): void {
  try {
    const next = chats.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX);
    localStorage.setItem(storageKey(projectRef), JSON.stringify(next));
  } catch {
    /* 저장 못 해도 화면은 그대로 돌아간다 */
  }
  emit();
}

/** 같은 id 가 있으면 덮어쓴다. */
export function saveChat(projectRef: string, chat: Chat): void {
  write(projectRef, [chat, ...read(projectRef).filter((c) => c.id !== chat.id)]);
}

export function removeChat(projectRef: string, id: string): void {
  write(
    projectRef,
    read(projectRef).filter((c) => c.id !== id)
  );
}

/** 목록에 쓸 제목. 첫 질문이 곧 제목이다 — 따로 물어보지 않는다. */
export function chatTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content.trim() ?? "";
  const oneLine = first.replace(/\s+/g, " ");
  return oneLine.length > TITLE_LENGTH
    ? `${oneLine.slice(0, TITLE_LENGTH)}…`
    : oneLine || "새 대화";
}
