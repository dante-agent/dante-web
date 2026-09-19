"use client";

// 폴더 보기 오른쪽에 붙는 AI 채팅. 토글 버튼(닫힘: 우하단 떠 있는 버튼)으로 열고 닫는다.
//
// layout 에서 children 을 감싸므로 파일을 옮겨 다녀도 이 컴포넌트는 살아 있다
// — 대화가 파일 클릭마다 날아가지 않는다.
//
// 대화 기록은 서버에 저장한다(본인만 본다). 이 컴포넌트는 지난 대화를 들고 있지 않고
// react-query 캐시에서 읽는다. 전송할 때도 과거 메시지는 보내지 않는다 — 서버가 DB 에서
// 읽는다. 클라이언트가 보낸 대화를 믿으면 "AI 가 하지 않은 말"을 끼워 넣을 수 있다.

import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
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
import { ChatMarkdown } from "@/components/chat-markdown";
import { requestTestTyping } from "@/components/generation/test-typing-request";
import { requestTestRun } from "@/components/run-terminal";
import { Button } from "@/components/ui/button";
import { splitStream } from "@/lib/chat/stream-tail";
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

/** 대화 하나에 담을 수 있는 메시지 수(질문·답 합계). 서버도 같은 값으로 막는다(409). */
const MAX_MESSAGES = 50;
/**
 * 대화 하나의 컨텍스트 토큰 상한. 입력창 위 상태 바의 % 가 이 값 대비 비율이다.
 * 서버(lib/chat/conversations.ts)와 같은 값 — 왜 5만인지는 거기 적었다.
 */
const MAX_CONTEXT_TOKENS = 50_000;
/** 이 비율부터 게이지를 경고 톤으로. 가득 차기 전에 새 대화를 떠올리게. */
const WARN_RATIO = 0.8;
/**
 * 빈 대화에 띄우는 질문. 서버 도구(updateTestFile·runTests)로 할 수 있는 일을 보여준다.
 * 테스트가 없으면 설명·실행할 게 없다. 수정 모드엔 도구도 터미널도 없으니 실행은 빼고,
 * 고쳐 달라는 답은 After 에 꽂는 코드로 온다.
 */
const suggestedPrompts = (hasTest: boolean, editing: boolean) =>
  hasTest
    ? [
        "Explain the test code for this file",
        "Update the tests for this file",
        ...(editing ? [] : ["Run the tests for this file"]),
      ]
    : ["Write tests for this file"];

/**
 * 본문이 지금 연 파일의 테스트 코드를 알리는 통로(없으면 null). dock 밖(PR 화면)에서는 아무 일도 안 한다.
 * 유무뿐 아니라 내용까지 싣는 이유: 답의 코드가 이미 저장된 내용과 같으면 Apply 를 막아야 하는데,
 * 버튼의 "누름" 표시는 컴포넌트 state 라 새로고침·모드 전환에 초기화된다.
 */
const CurrentTestContext = createContext<(test: string | null) => void>(() => {});

/** 본문(FileView)이 부른다. 채팅은 본문과 형제라 테스트를 따로 받아오지 않고 이렇게 전해 받는다. */
export function useReportCurrentTest(test: string | null) {
  const report = useContext(CurrentTestContext);
  useEffect(() => report(test), [report, test]);
}

// ── 서버 계약 (/api/chat, /api/chat/conversations) ─────────────────────────────
type Role = "user" | "assistant";
/** filePath = 이 메시지를 보낼 때 열어 둔 파일(없으면 null). 답변의 Apply 대상이다. */
type Msg = { role: Role; content: string; filePath: string | null };
type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  /** 마지막 답 기준 실제 컨텍스트 토큰(입력+출력). */
  contextTokens: number;
  messages: (Msg & { createdAt: string })[];
};
type ConversationSummary = { id: string; title: string; updatedAt: string; messageCount: number };
type ConversationPage = { items: ConversationSummary[]; nextCursor: string | null };

/** 대화 목록은 파일마다 따로다(서버도 파일로 거른다). */
const conversationsKey = (projectRef: string, file: string | null) =>
  ["chat", "conversations", projectRef, file] as const;

/** 이 파일의 대화 목록. 패널(이어 보기)과 기록 화면이 같은 캐시를 쓴다. */
function useConversationList(projectRef: string, file: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: conversationsKey(projectRef, file),
    queryFn: ({ pageParam }) =>
      getJson<ConversationPage>(
        `/api/chat/conversations?${new URLSearchParams({
          projectRef,
          filePath: file ?? "",
          ...(pageParam && { cursor: pageParam }),
        })}`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && file !== null,
  });
}
const conversationKey = (id: string | null) => ["chat", "conversation", id] as const;

/** 서버 상태코드를 catch 까지 들고 가려고 감싼다. fetch 는 !ok 를 throw 하지 않는다. */
class ResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 서버가 준 구분값. 409 는 "conversation_full" 이다. */
    readonly code?: string
  ) {
    super(message);
    this.name = "ResponseError";
  }
}

/** !ok 응답을 ResponseError 로. 서버 문구가 있으면 그대로 쓴다(줄바꿈 포함). */
async function toResponseError(response: Response): Promise<ResponseError> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    code?: string;
  } | null;
  return new ResponseError(
    body?.error ?? "No response received.\nPlease try again in a moment.",
    response.status,
    body?.code
  );
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw await toResponseError(response);
  return (await response.json()) as T;
}

/** 끌어서 줄일 수 있는 최소 폭(px). 헤더 버튼 셋과 입력창이 깨지지 않는 선. */
const MIN_WIDTH = 288;
/** 최대 폭(dock 폭 대비). 본문 에디터가 쓸 자리를 남긴다. */
const MAX_RATIO = 0.6;

export function AiChatDock({ projectRef, children }: { projectRef: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

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
      <div className="min-w-0 flex-1">
        <CurrentTestContext value={setCurrentTest}>{children}</CurrentTestContext>
      </div>

      {/* 패널은 계속 붙어 있고 폭만 0 ↔ 기본 폭으로 움직인다. 그래야 본문이 같이
          부드럽게 줄고(늘고), 닫았다 열어도 대화가 남는다. 본문과는 border-l 한 줄로만
          나눈다 — 여백을 두면 에디터가 화면 끝까지 못 간다. */}
      <aside
        aria-label="AI chat"
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
            aria-label="Resize AI chat"
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
          <FileChatPanel
            projectRef={projectRef}
            open={open}
            width={width}
            currentTest={currentTest}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      </aside>

      {!open && (
        <Button
          onClick={() => setOpen(true)}
          title="Open AI chat"
          className="animate-in fade-in zoom-in-95 fixed right-8 bottom-14 z-30 h-11 gap-2 rounded-full px-4 shadow-lg duration-200"
        >
          <Sparkles />
          AI Chat
        </Button>
      )}
    </div>
  );
}

type PanelProps = {
  projectRef: string;
  open: boolean;
  /** 사용자가 끌어서 정한 폭(px). null 이면 기본 폭 클래스. */
  width: number | null;
  /** 지금 연 파일의 테스트 코드(없으면 null). 추천 질문과 Apply 버튼 상태가 이걸로 갈린다. */
  currentTest: string | null;
  onClose: () => void;
};

/**
 * 대화는 파일마다 따로라, 파일이 바뀌면 패널을 새로 띄운다(key). 보던 대화·입력·기록 화면이
 * 다른 파일로 따라가지 않는다. 진행 중인 답은 언마운트에서 끊긴다(저장되지 않음).
 */
function FileChatPanel(props: PanelProps) {
  const searchParams = useSearchParams();
  const file = searchParams.get("file");
  // 수정 모드에선 AI 가 파일을 저장하지 않는다(서버가 도구를 주지 않는다). 답의 코드는
  // Apply 로 After 칸에 꽂고, 저장 여부는 사용자가 diff 를 보고 Save 로 정한다.
  const editing = searchParams.get("mode") === "edit";
  // key 는 파일뿐이다 — 보기 ↔ 수정을 오가도 대화는 이어진다.
  return <ChatPanel key={file ?? ""} file={file} editing={editing} {...props} />;
}

function ChatPanel({
  projectRef,
  open,
  width,
  currentTest,
  onClose,
  file,
  editing,
}: PanelProps & { file: string | null; editing: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // 서버에 아직 없는 꼬리: 보내는 중인 질문과 스트리밍 중인 답. 끝나면 캐시로 옮기고 비운다.
  // 중단된 답은 aborted 로 표시해 남긴다(저장되지 않았다고 알려주려고). 다음 전송 때 지운다
  // — 서버 대화에 없는 턴이라 그 뒤에 새 턴이 붙으면 순서가 거짓말이 된다.
  // unsaved = 답은 끝까지 받았지만 서버가 대화에 저장하지 못한 턴. 표시와 처리는 aborted 와 같다.
  const [tail, setTail] = useState<(Msg & { aborted?: boolean; unsaved?: boolean })[]>([]);

  // 파일로 돌아오면 그 파일의 가장 최근 대화를 이어서 연다. 목록이 처음 왔을 때 한 번만 정한다
  // (undefined = 아직). 그 뒤 목록이 다시 받아져도(다른 탭에서 새 대화 등) 보던 화면이 튀지 않고,
  // 그 사이 첫 질문을 이미 보냈으면(tail) 옛 대화로 넘기지 않는다. effect 대신 렌더 중에 정한다.
  // 패널을 닫아 둔 채 파일만 옮겨 다닐 땐 받지 않는다 — 열면 그때 받아 이어 본다.
  const list = useConversationList(projectRef, file, open);
  const [resumeId, setResumeId] = useState<string | null | undefined>(undefined);
  if (resumeId === undefined && list.isFetched) {
    setResumeId(tail.length === 0 ? (list.data?.pages[0]?.items[0]?.id ?? null) : null);
  }

  // 지금 보고 있는 대화의 서버 id. null = 아직 저장 안 된 새 대화.
  // 서버가 첫 답을 저장하고 id 를 돌려준 뒤에야 채운다 — 중단된 새 대화는 저장되지 않으므로
  // id 를 미리 들고 있으면 없는 대화를 가리키게 된다. 직접 고른 게 없으면 이어 보기 대화.
  const [chosenId, setConversationId] = useState<string | null>(null);
  const conversationId = chosenId ?? resumeId ?? null;
  const conversation = useQuery({
    queryKey: conversationKey(conversationId),
    queryFn: () => getJson<Conversation>(`/api/chat/conversations/${conversationId}`),
    enabled: conversationId !== null,
    // 대화는 내가 보낼 때만 바뀌고, 그때는 캐시에 직접 붙인다. 다시 받아올 이유가 없다.
    staleTime: Infinity,
  });
  const saved = conversation.data?.messages;
  const messages = [...(saved ?? []), ...tail];

  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 가득 참은 서버에 저장된 값 기준이다 — 서버가 409 로 막는 기준과 같아야 화면이 먼저
  // 막을 수 있다. 서버가 409 를 주면(다른 탭에서 채웠다든지) 화면 값과 상관없이 가득 참.
  const [fullFromServer, setFullFromServer] = useState(false);
  const tokens = conversation.data?.contextTokens ?? 0;
  const full =
    fullFromServer || (saved?.length ?? 0) >= MAX_MESSAGES || tokens >= MAX_CONTEXT_TOKENS;

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
  // messages 는 렌더마다 새 배열이라 의존성으로 쓰면 입력할 때마다 맨 아래로 튄다.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [saved, tail]);

  // 패널을 닫거나(폭 0) 화면을 떠나면 진행 중인 요청도 끊는다.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 다른 대화로 옮긴다(null = 새 대화). 진행 중인 요청은 끊고 화면에만 있던 것은 버린다. */
  function switchTo(id: string | null) {
    abortRef.current?.abort();
    setConversationId(id);
    // 직접 옮겼으면 이어 보기는 끝났다 — New chat 으로 비운 화면에 옛 대화가 다시 뜨지 않게.
    setResumeId(null);
    setTail([]);
    setError(null);
    setFullFromServer(false);
    setShowHistory(false);
  }

  function newChat() {
    switchTo(null);
    setInput("");
  }

  async function removeConversation(id: string) {
    const response = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    // 실패해도 목록은 다시 받는다 — 지워졌는지는 서버 목록이 말해준다.
    void queryClient.invalidateQueries({ queryKey: conversationsKey(projectRef, file) });
    if (!response.ok) return;
    queryClient.removeQueries({ queryKey: conversationKey(id) });
    // 지금 보고 있는 대화를 지웠으면 새 대화로 비운다(목록에는 그대로 머문다).
    if (id === conversationId) {
      switchTo(null);
      setShowHistory(true);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending || full || !file) return;

    const user: Msg = { role: "user", content, filePath: file };
    // 빈 assistant 말풍선을 먼저 놓고 조각이 올 때마다 채운다.
    // 앞서 중단된 턴(aborted)은 여기서 버린다 — 위 tail 주석 참고.
    setTail([user, { role: "assistant", content: "", filePath: file }]);
    setInput("");
    setError(null);
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    // 요청 시점의 대화. 스트리밍 중에 다른 대화로 옮기면 요청이 끊기므로 이 값이 기준이다.
    const sentTo = conversationId;

    // 받은 스트림을 따로 모아둔다 — 캐시에 붙일 때 state 가 반영되길 기다리지 않으려고.
    // 끝에 꼬리(토큰 수·저장 여부·채팅이 한 일)가 붙어 오므로 화면에는 그 앞까지만 쓴다(stream-tail.ts).
    let raw = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectRef,
          conversationId: sentTo,
          file,
          mode: editing ? "edit" : "view",
          message: content,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw await toResponseError(response);

      const id = response.headers.get("x-conversation-id") ?? sentTo;
      if (!id)
        throw new ResponseError(
          "Couldn't save the conversation.\nPlease try again in a new chat.",
          500
        );

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += value;
        const shown = splitStream(raw).answer;
        setTail((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: shown } : m))
        );
      }
      const { answer, tail } = splitStream(raw);
      // 토큰 수를 못 받았으면 이전 값을 그대로 둔다.
      const contextTokens = tail?.contextTokens ?? undefined;

      // 채팅이 테스트를 고쳤으면 Test Code 칸을 다시 읽고, 실행을 부탁받았으면 터미널에서 돌린다.
      // 대화 저장과 상관없이 이미 일어난 일이라 먼저 처리한다.
      // 고친 코드는 Test Code 칸에서 타이핑 연출로 보여준다(새로 읽어 온 뒤 FileView 가 재생).
      if (tail?.actions.edited && file) requestTestTyping(file);
      if (tail?.actions.edited) router.refresh();
      if (tail?.actions.runVersionId) {
        requestTestRun({ file, versionId: tail.actions.runVersionId });
      }

      // 서버에 안 남은 턴을 대화에 붙이면, 다시 열었을 때 사라져 화면이 거짓말을 한 셈이 된다.
      // 받은 답은 보여주되 저장 안 됐다고 표시하고, 새 대화였다면 id 도 잡지 않는다.
      if (tail && !tail.saved) {
        setTail((prev) => prev.map((m) => (m.role === "assistant" ? { ...m, unsaved: true } : m)));
        return;
      }

      // 서버는 스트림이 끝나면 두 메시지를 저장한다. 같은 모양을 캐시에 붙여 다시 받지 않는다.
      // 캐시를 먼저 채우고 id 를 바꿔야 새 대화일 때 useQuery 가 빈 캐시로 요청을 보내지 않는다.
      const now = new Date().toISOString();
      const pair = [
        { ...user, createdAt: now },
        { role: "assistant" as const, content: answer, filePath: file, createdAt: now },
      ];
      queryClient.setQueryData<Conversation>(conversationKey(id), (old) =>
        old
          ? {
              ...old,
              updatedAt: now,
              contextTokens: contextTokens ?? old.contextTokens,
              messages: [...old.messages, ...pair],
            }
          : { id, title: "", updatedAt: now, contextTokens: contextTokens ?? 0, messages: pair }
      );
      setConversationId(id);
      setTail([]);
      void queryClient.invalidateQueries({ queryKey: conversationsKey(projectRef, file) });
    } catch (e) {
      if (controller.signal.aborted) {
        // 서버는 중단된 턴을 저장하지 않는다. 받은 만큼은 보여주되 저장 안 됐다고 표시한다.
        // 새 대화였다면 conversationId 는 애초에 채우지 않았으니 null 그대로다.
        setTail((prev) =>
          prev
            .filter((m) => m.role === "user" || m.content !== "")
            .map((m) => (m.role === "assistant" ? { ...m, aborted: true } : m))
        );
        return;
      }

      if (e instanceof ResponseError && e.code === "conversation_full") setFullFromServer(true);
      setError({
        kind: e instanceof ResponseError && e.status === 402 ? "limit" : "error",
        message: e instanceof Error ? e.message : "Request failed.\nPlease try again in a moment.",
      });
      // 저장되지 않은 턴은 화면에서 걷고 질문은 입력창에 돌려준다 — 다시 보내기 쉽게.
      // 보낸 것처럼 남겨두면 서버 대화와 화면이 어긋난다.
      setTail([]);
      setInput((current) => current || content);
    } finally {
      setPending(false);
      abortRef.current = null;
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
        <span className="font-semibold">AI Chat</span>
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
            title="Chat history"
            aria-label="Chat history"
            className={cn(showHistory && "bg-muted text-foreground")}
          >
            <History />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={newChat}
            disabled={conversationId === null && messages.length === 0 && !showHistory}
            title="New chat"
            aria-label="New chat"
          >
            <SquarePen />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            title="Close"
            aria-label="Close AI chat"
          >
            <X />
          </Button>
        </div>
      </header>

      {showHistory ? (
        <HistoryList
          projectRef={projectRef}
          file={file}
          currentId={conversationId}
          onOpen={switchTo}
          onRemove={(id) => void removeConversation(id)}
        />
      ) : (
        // 메시지 영역만 한 단계 어둡게(Mauve 1). 헤더·입력 영역(Mauve 2)이 위아래 틀이 되고
        // 내용은 그 사이에 들어앉은 것으로 읽힌다 — 셋이 같은 색이면 한 덩어리로 보인다.
        <div ref={listRef} className="bg-background flex-1 space-y-3 overflow-y-auto p-3">
          {conversation.isPending && conversationId !== null ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            </div>
          ) : conversation.isError ? (
            <p className="text-destructive text-sm leading-relaxed wrap-break-word whitespace-pre-line">
              {conversation.error.message}
            </p>
          ) : messages.length === 0 ? (
            file ? (
              // 채팅이 테스트를 쓰고 돌릴 수 있다는 걸 모르는 사용자가 많아서, 누르면 바로 보내는 질문을 둔다.
              // ponytail: 러너가 없는 레포에서도 같은 질문이다. 그때는 모델이 셋업부터 하라고 안내한다.
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
                <p className="text-muted-foreground text-center text-sm">Ask about this file.</p>
                <div className="flex flex-col items-stretch gap-2">
                  {suggestedPrompts(currentTest !== null, editing).map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      disabled={pending || full}
                      onClick={() => void send(prompt)}
                      className="animate-in fade-in slide-in-from-bottom-1 justify-start rounded-full duration-200"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
                Open a file on the left to chat about it.
              </p>
            )
          ) : (
            // 말풍선은 글자 수만큼만 넓어진다(flex 안에서 shrink-to-fit). 길어지면
            // max-w 에서 멈추고 줄바꿈으로 아래로 늘어난다. wrap-break-word 는
            // 공백 없는 긴 토큰(URL·식별자)이 패널 밖으로 삐져나가지 않게.
            messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
                <div
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 text-sm wrap-break-word duration-200",
                    m.role === "user"
                      ? // 말풍선 모양은 Figma(찾아줘 v2.0, node 14407:155707) 기준:
                        // radius 24, 보내는 쪽 모서리만 각지게(= 꼬리), 패딩 16/12,
                        // 14px medium, line-height 1.4. 색은 우리 토큰 그대로.
                        // 85% 상한은 유지 — 반대쪽에 여백이 남아야 누가 한 말인지 보인다.
                        "bg-primary text-primary-foreground max-w-[85%] rounded-3xl rounded-br-none px-4 py-3 leading-[1.4] font-medium whitespace-pre-wrap"
                      : "text-foreground max-w-full leading-relaxed"
                  )}
                >
                  {m.role === "user" ? (
                    <CollapsibleText text={m.content} />
                  ) : m.content ? (
                    // 사용자 메시지는 입력한 그대로(pre-wrap), AI 답변만 마크다운으로 그린다.
                    <ChatMarkdown
                      text={m.content}
                      streaming={pending && i === messages.length - 1}
                      projectRef={projectRef}
                      applyFile={m.filePath}
                      // 지금 열어 둔 파일에 대한 답일 때만 After 에 꽂는다 — 다른 파일 답이면
                      // 꽂을 에디터가 화면에 없다.
                      applyWhere={editing && m.filePath === file ? "after" : "version"}
                      // 지금 열어 둔 파일의 답일 때만 "이미 적용됨"을 알 수 있다. 다른 파일 답이면
                      // 비교할 내용이 화면에 없으니 그냥 누를 수 있게 둔다.
                      appliedCode={m.filePath === file ? currentTest : null}
                    />
                  ) : (
                    pending && <Loader2 className="text-muted-foreground size-4 animate-spin" />
                  )}
                  {"aborted" in m && m.aborted && (
                    <p className="text-muted-foreground mt-1 text-xs">Stopped · Not saved</p>
                  )}
                  {"unsaved" in m && m.unsaved && (
                    <p role="alert" className="text-destructive mt-1 text-xs">
                      Couldn&apos;t save this reply. It won&apos;t be here when you reopen this
                      chat.
                    </p>
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
          {/* 가득 찬 대화에는 더 붙일 수 없다(서버도 409). 이어 쓰려면 새 대화뿐이라 그 버튼을 바로 옆에 둔다. */}
          {full && (
            <div className="text-muted-foreground mb-2 flex items-center justify-between gap-2 text-xs">
              <span>This chat is full. Continue in a new chat.</span>
              <Button type="button" size="sm" variant="outline" onClick={newChat}>
                <SquarePen />
                New Chat
              </Button>
            </div>
          )}
          <ContextBar tokens={full ? MAX_CONTEXT_TOKENS : tokens} />
          <div className="border-input bg-muted focus-within:border-ring flex items-end gap-1.5 rounded-xl border p-2 shadow-lg shadow-black/40 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              disabled={full || !file}
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
              aria-label="Message AI chat"
              className="text-foreground placeholder:text-muted-foreground block max-h-42 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-0.5 text-sm leading-7 outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            {pending ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => abortRef.current?.abort()}
                title="Stop"
                aria-label="Stop"
              >
                <Square />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                disabled={!input.trim() || full || !file}
                title="Send"
                aria-label="Send"
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
          className="text-primary-foreground mt-1.5 text-xs font-semibold underline-offset-2 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

/**
 * 입력창 위 한 줄 "Context N%": 마지막 답의 실제 토큰(모델이 알려준 입력+출력)이 상한의 몇 % 인지.
 * 답이 끝날 때만 바뀐다 — 보내기 전에는 실제 값을 알 수 없어 추정치를 섞지 않는다.
 * 입력창 안에 두면 버튼과 자리를 다퉈서 따로 한 줄을 준다.
 * 경고 톤부터는 "곧 새 대화를 시작해야 한다"를 먼저 알린다.
 */
function ContextBar({ tokens }: { tokens: number }) {
  const ratio = Math.min(tokens / MAX_CONTEXT_TOKENS, 1);
  const warn = ratio >= WARN_RATIO;
  return (
    <div
      title={`${tokens.toLocaleString()} / ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens`}
      className={cn(
        "mb-1.5 px-1 text-[11px] tabular-nums",
        warn ? "text-brand-orange font-semibold" : "text-muted-foreground"
      )}
    >
      Context {Math.round(ratio * 100)}%
    </div>
  );
}

/**
 * 저장된 대화 목록. 줄을 누르면 그 대화를 불러온다.
 *
 * 20개씩 받고 끝에 "더보기" 버튼을 둔다. 무한스크롤이 아닌 이유: 대부분 최근 대화만
 * 열어서, 스크롤만으로 요청이 나가면 안 볼 페이지까지 받는다. 패널이 좁고 짧아 스크롤
 * 끝에 금방 닿기도 한다. 목록은 이 화면이 열릴 때 받고(패널 목록을 켤 때마다 마운트),
 * 전송·삭제 때는 부르는 쪽이 invalidate 한다.
 */
function HistoryList({
  projectRef,
  file,
  currentId,
  onOpen,
  onRemove,
}: {
  projectRef: string;
  file: string | null;
  currentId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const list = useConversationList(projectRef, file);

  if (list.isPending) {
    return (
      <div className="bg-background flex flex-1 justify-center pt-10">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
      </div>
    );
  }
  if (list.isError) {
    return (
      <p className="bg-background text-destructive flex-1 px-6 pt-10 text-center text-sm whitespace-pre-line">
        {list.error.message}
      </p>
    );
  }

  const chats = list.data.pages.flatMap((page) => page.items);
  if (chats.length === 0) {
    return (
      <p className="bg-background text-muted-foreground flex-1 pt-10 text-center text-sm">
        No saved chats.
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
              onClick={() => onOpen(chat.id)}
              className="min-w-0 flex-1 py-2 text-left"
            >
              <span className="block truncate text-sm">{chat.title}</span>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })} ·{" "}
                {chat.messageCount} {chat.messageCount === 1 ? "message" : "messages"}
              </span>
            </button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onRemove(chat.id)}
              title="Delete"
              aria-label={`Delete ${chat.title}`}
              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
            >
              <Trash2 />
            </Button>
          </div>
        </li>
      ))}
      {list.hasNextPage && (
        <li className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
            className="text-muted-foreground w-full"
          >
            {list.isFetchingNextPage && <Loader2 className="animate-spin" />}
            Load more
          </Button>
        </li>
      )}
    </ul>
  );
}
