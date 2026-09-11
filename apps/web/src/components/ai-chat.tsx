"use client";

// 폴더 보기 오른쪽에 붙는 AI 채팅. 토글 버튼(닫힘: 우하단 떠 있는 버튼)으로 열고 닫는다.
//
// layout 에서 children 을 감싸므로 파일을 옮겨 다녀도 이 컴포넌트는 살아 있다
// — 대화가 파일 클릭마다 날아가지 않는다. 대화 기록은 lib/chat-history.ts (localStorage).

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { History, Loader2, Send, Sparkles, Square, SquarePen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chatTitle,
  removeChat,
  saveChat,
  useChats,
  type Chat,
  type ChatMessage as Msg,
} from "@/lib/chat-history";
import { cn } from "@/lib/utils";

/** 본문과 같은 높이. file-view / folder-empty-state 와 같은 값이다. */
const PANE_HEIGHT = "h-[calc(100svh-7rem)]";

const SUGGESTIONS = [
  "이 파일은 무슨 일을 하나요?",
  "어떤 테스트가 필요할까요?",
  "놓치기 쉬운 엣지 케이스는?",
];

export function AiChatDock({ projectRef, children }: { projectRef: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">{children}</div>

      {/* 패널은 계속 붙어 있고 폭만 0 ↔ 22rem 으로 움직인다. 그래야 본문이 같이
          부드럽게 줄고(늘고), 닫았다 열어도 대화가 남는다. 여백(ml-4)은 안쪽에
          둬서 닫혔을 때 같이 접힌다. */}
      <aside
        // 닫혀 있을 때 폭 0 짜리 안쪽 버튼·입력창으로 탭 이동이 들어가지 않게.
        inert={!open}
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-300 ease-out",
          open ? "w-[22rem] xl:w-[26rem]" : "w-0"
        )}
      >
        {/* useSearchParams 를 쓰므로 경계를 둔다(정적 렌더 이탈 방지). */}
        <Suspense fallback={null}>
          <ChatPanel projectRef={projectRef} open={open} onClose={() => setOpen(false)} />
        </Suspense>
      </aside>

      {!open && (
        <Button
          onClick={() => setOpen(true)}
          title="AI 채팅 열기"
          className="animate-in fade-in zoom-in-95 fixed right-8 bottom-8 z-30 h-11 gap-2 rounded-full px-4 shadow-lg duration-200"
        >
          <Sparkles />
          AI 채팅
        </Button>
      )}
    </div>
  );
}

function ChatPanel({
  projectRef,
  open,
  onClose,
}: {
  projectRef: string;
  open: boolean;
  onClose: () => void;
}) {
  const file = useSearchParams().get("file");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 지금 쓰고 있는 대화 + 저장된 목록. 목록 보기로 전환하면 이 패널이 목록을 덮는다.
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);
  const chats = useChats(projectRef);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 패널을 닫거나(폭 0) 화면을 떠나면 진행 중인 요청도 끊는다.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function resetChat() {
    abortRef.current?.abort();
    setChatId(crypto.randomUUID());
    setMessages([]);
    setInput("");
    setError(null);
  }

  function newChat() {
    resetChat();
    setShowHistory(false);
  }

  function openChat(chat: Chat) {
    abortRef.current?.abort();
    setChatId(chat.id);
    setMessages(chat.messages);
    setError(null);
    setShowHistory(false);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;

    const sent: Msg[] = [...messages, { role: "user", content }];
    // 빈 assistant 말풍선을 먼저 놓고 조각이 올 때마다 채운다.
    setMessages([...sent, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // 받은 답을 따로 모아둔다 — 저장할 때 state 가 반영되길 기다리지 않으려고.
    let answer = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectRef, file, messages: sent }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body: unknown = await response.json().catch(() => null);
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ?? "응답을 받지 못했습니다.");
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += value;
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content + value } : m))
        );
      }
    } catch (e) {
      // 사용자가 중단한 것이면 여기까지 받은 답을 그대로 남긴다.
      if (!(e instanceof Error && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "요청에 실패했습니다.");
        // 한 글자도 못 받은 말풍선은 지운다.
        setMessages((prev) => prev.filter((m, i) => i !== prev.length - 1 || m.content !== ""));
      }
    } finally {
      setPending(false);
      abortRef.current = null;

      // 답이 한 글자라도 왔을 때만 기록에 남긴다(중단해도 남는다). 조각마다 쓰면
      // 토큰 수만큼 localStorage 쓰기가 일어나므로 끝난 뒤 한 번만.
      if (answer) {
        const saved: Msg[] = [...sent, { role: "assistant", content: answer }];
        saveChat(projectRef, {
          id: chatId,
          title: chatTitle(saved),
          updatedAt: Date.now(),
          messages: saved,
        });
      }
    }
  }

  return (
    <div
      className={cn(
        // 폭은 고정 — 바깥 aside 가 접히는 동안 내용이 찌그러지지 않게. 내용은
        // 폭이 어느 정도 열린 뒤에 따라 들어온다(delay).
        "border-border bg-sidebar ml-4 flex w-[21rem] flex-col overflow-hidden rounded-lg border transition-opacity duration-200 xl:w-[25rem]",
        open ? "opacity-100 delay-150" : "opacity-0",
        PANE_HEIGHT
      )}
    >
      <header className="border-border flex h-10 shrink-0 items-center gap-1.5 border-b px-2.5 text-sm">
        <Sparkles className="text-brand-orange size-4" />
        <span className="font-semibold">AI 채팅</span>
        {file && !showHistory && (
          <span className="text-muted-foreground ml-1 truncate font-mono text-xs">
            {file.split("/").pop()}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setShowHistory((v) => !v)}
            aria-pressed={showHistory}
            title="대화 기록"
            aria-label="대화 기록"
            className={cn(showHistory && "bg-muted text-foreground")}
          >
            <History />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={newChat}
            disabled={messages.length === 0 && !showHistory}
            title="새 대화"
            aria-label="새 대화"
          >
            <SquarePen />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            title="닫기"
            aria-label="AI 채팅 닫기"
          >
            <X />
          </Button>
        </div>
      </header>

      {showHistory ? (
        <HistoryList
          chats={chats}
          currentId={chatId}
          onOpen={openChat}
          onRemove={(id) => {
            removeChat(projectRef, id);
            // 지금 보고 있는 대화를 지웠으면 새 대화로 비운다(목록에는 그대로 머문다).
            if (id === chatId) resetChat();
          }}
        />
      ) : (
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="text-muted-foreground flex flex-col gap-2 pt-6 text-center text-sm">
              <p>
                {file
                  ? "이 파일에 대해 물어보세요."
                  : "왼쪽에서 파일을 열면 그 파일을 같이 봅니다."}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="border-border hover:bg-muted hover:text-foreground rounded-md border px-2.5 py-2 text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-1 text-sm leading-relaxed whitespace-pre-wrap duration-200",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-6 rounded-lg px-2.5 py-1.5"
                    : "text-foreground"
                )}
              >
                {m.content ||
                  (pending && <Loader2 className="text-muted-foreground size-4 animate-spin" />)}
              </div>
            ))
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
      )}

      {/* 입력창: 한 줄짜리 textarea 와 버튼을 가운데 정렬로 나란히 둔다.
          박스 패딩(p-2)만으로 아이콘 위아래 여백이 같아진다. */}
      {!showHistory && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="border-border shrink-0 border-t p-2"
        >
          <div className="border-border bg-background focus-within:border-ring flex items-center gap-1.5 rounded-lg border p-2 transition-colors">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter 전송 / Shift+Enter 줄바꿈. 조합 중(한글)에는 가로채지 않는다.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask anything — Enter to send"
              className="text-foreground placeholder:text-muted-foreground block max-h-28 min-w-0 flex-1 resize-none bg-transparent px-0.5 text-sm leading-7 outline-none"
            />
            {pending ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => abortRef.current?.abort()}
                title="중단"
                aria-label="중단"
              >
                <Square />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                disabled={!input.trim()}
                title="보내기"
                aria-label="보내기"
              >
                <Send />
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/** 저장된 대화 목록. 줄을 누르면 그 대화를 불러온다. */
function HistoryList({
  chats,
  currentId,
  onOpen,
  onRemove,
}: {
  chats: Chat[];
  currentId: string;
  onOpen: (chat: Chat) => void;
  onRemove: (id: string) => void;
}) {
  if (chats.length === 0) {
    return (
      <p className="text-muted-foreground flex-1 pt-10 text-center text-sm">
        저장된 대화가 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto p-2">
      {chats.map((chat) => (
        <li key={chat.id}>
          <div
            className={cn(
              "group hover:bg-muted flex items-center gap-2 rounded-md px-2",
              chat.id === currentId && "bg-muted"
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(chat)}
              className="min-w-0 flex-1 py-2 text-left"
            >
              <span className="block truncate text-sm">{chat.title}</span>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(chat.updatedAt, { addSuffix: true, locale: ko })} ·{" "}
                {chat.messages.length}개 메시지
              </span>
            </button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onRemove(chat.id)}
              title="삭제"
              aria-label={`${chat.title} 삭제`}
              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
            >
              <Trash2 />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
