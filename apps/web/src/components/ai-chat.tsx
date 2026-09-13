"use client";

// 폴더 보기 오른쪽에 붙는 AI 채팅. 토글 버튼(닫힘: 우하단 떠 있는 버튼)으로 열고 닫는다.
//
// layout 에서 children 을 감싸므로 파일을 옮겨 다녀도 이 컴포넌트는 살아 있다
// — 대화가 파일 클릭마다 날아가지 않는다. 대화 기록은 lib/chat-history.ts (localStorage).

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  History,
  Loader2,
  Send,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
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

/** 본문과 같은 높이(헤더 47px 만 빼면 화면 끝까지). file-view / folder-empty-state 와 같은 값. */
const PANE_HEIGHT = "h-[calc(100svh-47px)]";

/** 헤더에 쓸 짧은 경로 — 상위 폴더 한 단계까지. 전체 경로는 왼쪽 본문에 있다. */
const shortPath = (path: string) => path.split("/").slice(-2).join("/");

/**
 * 무엇이 실패했는지. `limit` 은 AI 사용 한도 초과(서버 402)다.
 *
 * 한도 초과를 일반 오류와 섞으면 "잠시 후 다시 시도"처럼 읽혀서 사용자가 계속 다시
 * 보낸다 — 다음 달까지 결과가 같다. 그래서 종류를 들고 다니며 다르게 그린다.
 */
type ChatError = { kind: "error" | "limit"; message: string };

/** 서버 상태코드를 catch 까지 들고 가려고 감싼다. fetch 는 !ok 를 throw 하지 않는다. */
class ResponseError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ResponseError";
  }
}

/** 끌어서 줄일 수 있는 최소 폭(px). 헤더 버튼 셋과 입력창이 깨지지 않는 선. */
const MIN_WIDTH = 288;
/** 최대 폭(dock 폭 대비). 본문 에디터가 쓸 자리를 남긴다. */
const MAX_RATIO = 0.6;

export function AiChatDock({ projectRef, children }: { projectRef: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // null = 아직 끌지 않음 → 기본 폭(22rem / xl 26rem) 클래스를 쓴다. 끈 뒤에는 px.
  // 저장하지 않는다 — 새로고침하면 기본 폭으로 돌아간다.
  const [width, setWidth] = useState<number | null>(null);
  // 끄는 동안에는 폭 transition 을 끈다. 켜두면 선이 커서를 300ms 늦게 따라온다.
  const [dragging, setDragging] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // file-view.tsx 의 DragDivider 와 같은 방식: pointer capture 로 커서가 선 밖으로
  // 나가도(에디터 위를 지나가도) move 이벤트를 계속 받는다.
  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onDividerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dockRef.current) return;
    const r = dockRef.current.getBoundingClientRect();
    const max = Math.max(MIN_WIDTH, r.width * MAX_RATIO);
    setWidth(Math.min(max, Math.max(MIN_WIDTH, r.right - e.clientX)));
  };
  const onDividerUp = () => setDragging(false);

  return (
    <div ref={dockRef} className="flex">
      <div className="min-w-0 flex-1">{children}</div>

      {/* 패널은 계속 붙어 있고 폭만 0 ↔ 기본 폭으로 움직인다. 그래야 본문이 같이
          부드럽게 줄고(늘고), 닫았다 열어도 대화가 남는다. 본문과는 border-l 한 줄로만
          나눈다 — 여백을 두면 에디터가 화면 끝까지 못 간다. */}
      <aside
        // 닫혀 있을 때 폭 0 짜리 안쪽 버튼·입력창으로 탭 이동이 들어가지 않게.
        inert={!open}
        style={open && width !== null ? { width } : undefined}
        className={cn(
          "relative shrink-0 overflow-hidden",
          !dragging && "transition-[width] duration-300 ease-out",
          !open ? "w-0" : width === null && "w-[22rem] xl:w-[26rem]"
        )}
      >
        {/* 구분선. aside 가 overflow-hidden 이라 바깥으로 걸치지 못하고 패널 안쪽
            왼쪽 끝 8px 을 잡는 영역으로 쓴다. 선은 border-l 자리에 겹쳐 보인다. */}
        {open && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="AI 채팅 너비 조절"
            onPointerDown={onDividerDown}
            onPointerMove={onDividerMove}
            onPointerUp={onDividerUp}
            onPointerCancel={onDividerUp}
            className="group absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize touch-none"
          >
            <span
              className={cn(
                "group-hover:bg-brand-orange/70 block h-full w-0.5 bg-transparent transition-colors",
                dragging && "bg-brand-orange/70"
              )}
            />
          </div>
        )}

        {/* useSearchParams 를 쓰므로 경계를 둔다(정적 렌더 이탈 방지). */}
        <Suspense fallback={null}>
          <ChatPanel
            projectRef={projectRef}
            open={open}
            width={width}
            onClose={() => setOpen(false)}
          />
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
  width,
  onClose,
}: {
  projectRef: string;
  open: boolean;
  /** 사용자가 끌어서 정한 폭(px). null 이면 기본 폭 클래스. */
  width: number | null;
  onClose: () => void;
}) {
  const file = useSearchParams().get("file");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 지금 쓰고 있는 대화 + 저장된 목록. 목록 보기로 전환하면 이 패널이 목록을 덮는다.
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);
  const chats = useChats(projectRef);

  // 입력창 높이를 내용에 맞춘다. CSS field-sizing: content 는 크롬 계열만 돼서 직접 잰다.
  // auto 로 한 번 접어야 줄이 줄었을 때도 줄어든다. 보내서 input 이 비면 한 줄로 돌아가고,
  // 패널 폭이 바뀌면 줄바꿈이 달라지므로 width 에도 다시 잰다.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, width, showHistory]);

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
        throw new ResponseError(
          message ?? "응답을 받지 못했습니다.\n잠시 후 다시 시도해주세요.",
          response.status
        );
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
        setError({
          kind: e instanceof ResponseError && e.status === 402 ? "limit" : "error",
          message:
            e instanceof Error ? e.message : "요청에 실패했습니다.\n잠시 후 다시 시도해주세요.",
        });
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
      // 폭은 바깥 aside 와 같은 값으로 고정 — aside 가 접히는 동안 내용이 찌그러지지
      // 않게. 내용은 폭이 어느 정도 열린 뒤에 따라 들어온다(delay).
      style={width !== null ? { width } : undefined}
      className={cn(
        "border-border bg-sidebar flex flex-col overflow-hidden border-l transition-opacity duration-200",
        width === null && "w-[22rem] xl:w-[26rem]",
        open ? "opacity-100 delay-150" : "opacity-0",
        PANE_HEIGHT
      )}
    >
      {/* h-9 = 왼쪽 본문 헤더 행(2.25rem)과 같은 높이 — 사이가 border-l 한 줄이라 선이 맞아야 한다 */}
      <header className="border-border flex h-9 shrink-0 items-center gap-1.5 border-b px-2.5 text-sm">
        <Sparkles className="text-brand-orange size-4" />
        <span className="font-semibold">AI 채팅</span>
        {file && !showHistory && (
          <span className="text-muted-foreground ml-1 truncate font-mono text-xs">
            {shortPath(file)}
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
        // 메시지 영역만 한 단계 어둡게(Mauve 1). 헤더·입력 영역(Mauve 2)이 위아래 틀이 되고
        // 내용은 그 사이에 들어앉은 것으로 읽힌다 — 셋이 같은 색이면 한 덩어리로 보인다.
        <div ref={listRef} className="bg-background flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 ? (
            // 안내 문구 한 줄이 전부다. 뭘 물어볼지는 사용자가 안다.
            <p className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
              {file ? "이 파일에 대해 물어보세요." : "왼쪽에서 파일을 열면 그 파일을 같이 봅니다."}
            </p>
          ) : (
            // 말풍선은 글자 수만큼만 넓어진다(flex 안에서 shrink-to-fit). 길어지면
            // max-w 에서 멈추고 줄바꿈으로 아래로 늘어난다. wrap-break-word 는
            // 공백 없는 긴 토큰(URL·식별자)이 패널 밖으로 삐져나가지 않게.
            messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
                <div
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 text-sm wrap-break-word whitespace-pre-wrap duration-200",
                    m.role === "user"
                      ? // 말풍선 모양은 Figma(찾아줘 v2.0, node 14407:155707) 기준:
                        // radius 24, 보내는 쪽 모서리만 각지게(= 꼬리), 패딩 16/12,
                        // 14px medium, line-height 1.4. 색은 우리 토큰 그대로.
                        // 85% 상한은 유지 — 반대쪽에 여백이 남아야 누가 한 말인지 보인다.
                        "bg-primary text-primary-foreground max-w-[85%] rounded-3xl rounded-br-none px-4 py-3 leading-[1.4] font-medium"
                      : "text-foreground max-w-full leading-relaxed"
                  )}
                >
                  {m.role === "user" ? (
                    <CollapsibleText text={m.content} />
                  ) : (
                    m.content ||
                    (pending && <Loader2 className="text-muted-foreground size-4 animate-spin" />)
                  )}
                </div>
              </div>
            ))
          )}

          {/* 오류 문구는 서버가 준 줄바꿈(\n)을 그대로 살린다 — 한 줄로 이어 붙으면 읽기 힘들다. */}
          {error &&
            (error.kind === "limit" ? (
              // 한도 초과는 고장이 아니라 계정 상태다. destructive(빨강)로 칠하면 "일시적
              // 오류"로 읽히니 테두리 있는 안내 블록으로 둔다 — 눈에는 띄지만 경고색은 아니다.
              // 입력창은 막지 않는다: 이 상태는 서버가 판정하는 것이고(한도를 올렸거나 달이
              // 바뀌었을 수 있다) 화면이 들고 있는 값은 이미 지난 정보다.
              <div className="border-border bg-background text-muted-foreground flex gap-2 rounded-lg border p-3 text-sm leading-relaxed">
                <Wallet className="text-brand-orange mt-0.5 size-4 shrink-0" />
                <p className="wrap-break-word whitespace-pre-line">{error.message}</p>
              </div>
            ) : (
              <p className="text-destructive text-sm leading-relaxed wrap-break-word whitespace-pre-line">
                {error.message}
              </p>
            ))}
        </div>
      )}

      {/* 입력창: textarea 는 내용만큼 자라고(최대 6줄, 그 뒤로는 안에서 스크롤) 버튼은
          아래에 붙는다 — 여러 줄일 때 마지막 줄 옆에 있어야 손이 덜 간다. 한 줄일 때는
          textarea 줄 높이(leading-7)와 버튼(size-7)이 같아 가운데 정렬과 똑같이 보인다.
          바깥 틀(border-t·Mauve 2 띠)은 두지 않는다. 메시지 영역과 같은 바탕 위에 입력 필드만
          올려서(Mauve 3 + 그림자) 대화 위에 떠 있는 칸으로 보이게 한다. */}
      {!showHistory && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="bg-background shrink-0 px-3 pb-3"
        >
          <div className="border-input bg-muted focus-within:border-ring flex items-end gap-1.5 rounded-xl border p-2 shadow-lg shadow-black/40 transition-colors">
            <textarea
              ref={inputRef}
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
              className="text-foreground placeholder:text-muted-foreground block max-h-42 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-0.5 text-sm leading-7 outline-none"
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

/**
 * 사용자 말풍선 본문. 8줄을 넘으면 접고 "더보기"로 편다.
 *
 * 코드를 붙여 넣고 물어보는 일이 많은데, 그대로 두면 말풍선 하나가 패널을 다 덮어서
 * 답을 보려면 한참 스크롤해야 한다. 줄 수(\n)가 아니라 실제 높이로 판단한다 — 줄바꿈
 * 없는 긴 문단도 패널 폭에서 여러 줄로 접히기 때문이다.
 */
function CollapsibleText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // 접힌 상태(line-clamp)에서 잘린 내용이 있을 때만 버튼을 보인다. 펼친 뒤에는 다시 재지
  // 않는다 — 펼친 상태에선 늘 안 넘치므로, 재면 "접기" 버튼이 사라진다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <>
      <p ref={ref} className={cn(!expanded && "line-clamp-8")}>
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-primary-foreground/80 hover:text-primary-foreground mt-1.5 text-xs font-semibold underline-offset-2 hover:underline"
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </>
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
      <p className="bg-background text-muted-foreground flex-1 pt-10 text-center text-sm">
        저장된 대화가 없습니다.
      </p>
    );
  }

  return (
    <ul className="bg-background flex-1 space-y-0.5 overflow-y-auto p-2">
      {chats.map((chat) => (
        <li key={chat.id}>
          <div
            className={cn(
              // pl-4: 목록 p-2 와 합쳐 24px — 대화 화면 본문(p-3 + 말풍선)과 같은 들여쓰기.
              "group hover:bg-muted flex items-center gap-2 rounded-md pr-1 pl-4",
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
