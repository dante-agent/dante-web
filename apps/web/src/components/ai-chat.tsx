"use client";

// 폴더 보기 오른쪽에 붙는 AI 채팅. 토글 버튼(닫힘: 우하단 떠 있는 버튼)으로 열고 닫는다.
//
// layout 에서 children 을 감싸므로 파일을 옮겨 다녀도 이 컴포넌트는 살아 있다
// — 대화가 파일 클릭마다 날아가지 않는다. 대신 새로고침하면 사라진다(서버에 안 저장).

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

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
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">{children}</div>

      {open ? (
        // useSearchParams 를 쓰므로 경계를 둔다(정적 렌더 이탈 방지).
        <Suspense fallback={null}>
          <ChatPanel projectRef={projectRef} onClose={() => setOpen(false)} />
        </Suspense>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          title="AI 채팅 열기"
          className="fixed right-8 bottom-8 z-30 h-11 gap-2 rounded-full px-4 shadow-lg"
        >
          <Sparkles />
          AI 채팅
        </Button>
      )}
    </div>
  );
}

function ChatPanel({ projectRef, onClose }: { projectRef: string; onClose: () => void }) {
  const file = useSearchParams().get("file");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 화면을 닫으면 진행 중인 요청도 끊는다.
  useEffect(() => () => abortRef.current?.abort(), []);

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
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content + value } : m))
        );
      }
    } catch (e) {
      // 사용자가 중단한 것이면 여기까지 받은 답을 그대로 남긴다.
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "요청에 실패했습니다.");
      // 한 글자도 못 받은 말풍선은 지운다.
      setMessages((prev) => prev.filter((m, i) => i !== prev.length - 1 || m.content !== ""));
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  }

  return (
    <aside
      className={cn(
        "border-border bg-sidebar flex w-[21rem] shrink-0 flex-col overflow-hidden rounded-lg border xl:w-[25rem]",
        PANE_HEIGHT
      )}
    >
      <header className="border-border flex h-9 shrink-0 items-center gap-1.5 border-b px-2.5 text-xs">
        <Sparkles className="text-brand-orange size-3.5" />
        <span className="font-semibold">AI 채팅</span>
        {file && (
          <span className="text-muted-foreground ml-1 truncate font-mono text-[10px]">
            {file.split("/").pop()}
          </span>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onClose}
          title="닫기"
          aria-label="AI 채팅 닫기"
          className="ml-auto"
        >
          <X />
        </Button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex flex-col gap-2 pt-6 text-center text-xs">
            <p>
              {file ? "이 파일에 대해 물어보세요." : "왼쪽에서 파일을 열면 그 파일을 같이 봅니다."}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="border-border hover:bg-muted hover:text-foreground rounded-md border px-2.5 py-1.5 text-left"
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
                "text-xs leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground ml-6 rounded-lg px-2.5 py-1.5"
                  : "text-foreground"
              )}
            >
              {m.content ||
                (pending && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />)}
            </div>
          ))
        )}

        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-border flex items-end gap-1.5 border-t p-2"
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter 전송 / Shift+Enter 줄바꿈. 조합 중(한글)에는 가로채지 않는다.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="무엇이든 물어보세요 (Enter 전송)"
          className="text-foreground placeholder:text-muted-foreground max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-xs outline-none"
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
          <Button type="submit" size="icon-sm" disabled={!input.trim()} title="보내기">
            <Send />
          </Button>
        )}
      </form>
    </aside>
  );
}
