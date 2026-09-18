"use client";

// 폴더 보기 본문 하단(소스·테스트 전체 너비)의 실행 터미널. 실행 API(/runs/live)가 흘려보내는 NDJSON 을 받아
// 단계(샌드박스 준비 → 설치 → 테스트)와 러너 출력을 실시간으로 그리고, 끝나면 개수 요약을 띄운다.
//
// 색: 러너 출력의 ANSI 코드를 anser 로 "글자 + 색" 조각으로 바꿔 React span 으로 그린다.
// HTML 문자열로 넣지 않는다 — 로그에는 사용자 코드·레포 내용이 섞인다.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Anser from "anser";
import { CheckCircle2, ChevronRight, ChevronUp, Loader2, TimerOff, XCircle } from "lucide-react";
import type { LiveRunMessage } from "@/app/api/projects/[projectRef]/runs/live/route";
import { parseStoredRunLog } from "@/lib/projects/stored-run-log";
import { cn } from "@/lib/utils";

type Step = "setup" | "install" | "toolkit" | "test";
type ResultMessage = Extract<LiveRunMessage, { type: "result" }>;

/** ms 가 null 이면 걸린 시간을 모른다(저장된 로그에는 단계 시간이 없다). */
type StepView = {
  state: "pending" | "running" | "done";
  ok: boolean;
  ms: number | null;
  text: string;
};

export type RunView = {
  running: boolean;
  steps: Record<Step, StepView>;
  result: ResultMessage | null;
};

/** 단계마다 화면에 남기는 출력 상한(글자). 긴 설치 로그가 탭 메모리를 잡아먹지 않게 앞을 버린다. */
const MAX_STEP_TEXT = 100_000;

const STEP_LABEL: Record<Step, string> = {
  setup: "Preparing sandbox",
  install: "Installing dependencies",
  toolkit: "Installing Dante test tools",
  test: "Running tests",
};

const emptyStep = (): StepView => ({ state: "pending", ok: false, ms: 0, text: "" });
const initialView = (): RunView => ({
  running: true,
  steps: { setup: emptyStep(), install: emptyStep(), toolkit: emptyStep(), test: emptyStep() },
  result: null,
});

function applyMessage(view: RunView, message: LiveRunMessage): RunView {
  if (message.type === "result") return { ...view, running: false, result: message };
  const current = view.steps[message.step];
  let next: StepView;
  if (message.type === "log") {
    const text = current.text + message.text;
    next = { ...current, text: text.length > MAX_STEP_TEXT ? text.slice(-MAX_STEP_TEXT) : text };
  } else if (message.state === "start") {
    next = { ...current, state: "running" };
  } else {
    next = { ...current, state: "done", ok: message.ok, ms: message.ms };
  }
  return { ...view, steps: { ...view.steps, [message.step]: next } };
}

const errorResult = (errorMessage: string): ResultMessage => ({
  type: "result",
  status: "error",
  errorMessage,
  timedOut: false,
  totals: null,
  failures: [],
  durationMs: 0,
});

/**
 * 실행 하나를 시작하고 상태를 들고 있는다. 언마운트(파일 이동·탭 닫기)되면 요청을 끊는다 —
 * 서버가 끊김을 보고 샌드박스를 내린다.
 */
export function useLiveRun(projectRef: string) {
  const [view, setView] = useState<RunView | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(
    async (versionId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setView(initialView());

      // 로그 조각이 초당 수십 개 올 수 있다. 조각마다 렌더하지 않고 프레임마다 모아서 반영한다.
      let queue: LiveRunMessage[] = [];
      let frame = 0;
      const flush = () => {
        frame = 0;
        const batch = queue;
        queue = [];
        setView((prev) => batch.reduce(applyMessage, prev ?? initialView()));
      };
      const push = (message: LiveRunMessage) => {
        queue.push(message);
        if (!frame) frame = requestAnimationFrame(flush);
      };

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectRef)}/runs/live`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ versionId }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          push(errorResult(body?.error ?? `Couldn't start the run (HTTP ${response.status}).`));
          return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let gotResult = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const message = JSON.parse(line) as LiveRunMessage;
            if (message.type === "result") gotResult = true;
            push(message);
          }
        }
        // 결과 없이 끝났으면 연결이 중간에 끊긴 것(서버 함수 종료 등). 멈춘 채로 두지 않는다.
        if (!gotResult)
          push(errorResult("The connection to the runner was lost before it finished."));
      } catch {
        if (controller.signal.aborted) return;
        push(errorResult("The connection to the runner was lost before it finished."));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [projectRef]
  );

  return { view, start };
}

/**
 * AI 채팅이 테스트 실행을 요청할 때 쓰는 창 이벤트. 채팅(layout)과 터미널(page 의 FileView)은
 * 서로 다른 트리라 props 로 이을 수 없다. 받는 쪽은 열려 있는 파일이 같을 때만 돈다.
 */
const RUN_REQUEST = "dante:run-test";
type RunRequest = { file: string; versionId: string };

export function requestTestRun(request: RunRequest) {
  window.dispatchEvent(new CustomEvent<RunRequest>(RUN_REQUEST, { detail: request }));
}

/** 이 파일에 대한 실행 요청을 받는다. 해제 함수를 돌려준다(useEffect 정리용). */
export function onTestRunRequest(file: string, run: (versionId: string) => void) {
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<RunRequest>;
    if (detail.file === file) run(detail.versionId);
  };
  window.addEventListener(RUN_REQUEST, listener);
  return () => window.removeEventListener(RUN_REQUEST, listener);
}

/** ANSI 색이 섞인 텍스트를 색 조각 span 으로 그린다. */
const AnsiText = memo(function AnsiText({ text }: { text: string }) {
  const parts = useMemo(() => Anser.ansiToJson(text, { remove_empty: true }), [text]);
  return (
    <>
      {parts.map((part, i) => (
        <span
          key={i}
          style={{
            color: part.fg ? `rgb(${part.fg})` : undefined,
            backgroundColor: part.bg ? `rgb(${part.bg})` : undefined,
          }}
          className={cn(
            part.decorations.includes("bold") && "font-bold",
            part.decorations.includes("dim") && "opacity-60",
            part.decorations.includes("italic") && "italic",
            part.decorations.includes("underline") && "underline"
          )}
        >
          {part.content}
        </span>
      ))}
    </>
  );
});

function formatMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function StepRow({
  step,
  view,
  open,
  onToggle,
}: {
  step: Step;
  view: StepView;
  open?: boolean;
  onToggle?: () => void;
}) {
  if (view.state === "pending") return null;
  const icon =
    view.state === "running" ? (
      <Loader2 className="text-chart-amber size-3.5 animate-spin" />
    ) : view.ok ? (
      <CheckCircle2 className="text-brand-mint size-3.5" />
    ) : (
      <XCircle className="text-destructive size-3.5" />
    );
  const label = (
    <>
      {icon}
      <span className="font-semibold">{STEP_LABEL[step]}</span>
      {view.state === "done" && view.ms !== null && (
        <span className="text-muted-foreground">{formatMs(view.ms)}</span>
      )}
    </>
  );
  return onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="hover:text-foreground flex items-center gap-2 py-0.5 text-left"
    >
      <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      {label}
    </button>
  ) : (
    <div className="flex items-center gap-2 py-0.5 pl-5.5">{label}</div>
  );
}

function Summary({ result }: { result: ResultMessage }) {
  const { totals } = result;
  return (
    <div className="border-border mt-3 border-t pt-2">
      {result.timedOut ? (
        <p className="text-brand-orange flex items-center gap-2 font-semibold">
          <TimerOff className="size-3.5" />
          {result.errorMessage ?? "Timed out"}
        </p>
      ) : result.status === "error" ? (
        <p className="text-destructive flex items-start gap-2 font-semibold whitespace-pre-wrap">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          {result.errorMessage ?? "The tests could not run."}
        </p>
      ) : null}

      {totals && (
        <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
          <span className="text-muted-foreground w-12">Tests</span>
          {totals.failed > 0 && <span className="text-destructive">{totals.failed} failed</span>}
          <span className="text-brand-mint">{totals.passed} passed</span>
          <span className="text-muted-foreground">({totals.total})</span>
          {result.durationMs > 0 && (
            <span className="text-muted-foreground ml-auto font-normal">
              {formatMs(result.durationMs)}
            </span>
          )}
        </p>
      )}

      {result.failures.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {result.failures.map((failure, i) => (
            <li key={i}>
              <span className="text-destructive">✗ </span>
              <span className="text-muted-foreground">{failure.file} › </span>
              {failure.name}
              {failure.message && (
                <div className="text-muted-foreground pl-4 whitespace-pre-wrap">
                  {failure.message}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 접힌 바에 한 줄로 보여줄 상태. */
function barStatus(view: RunView | null): {
  label: string;
  detail: string | null;
  className: string;
} {
  if (!view) return { label: "No runs yet", detail: null, className: "text-muted-foreground" };
  if (view.running) {
    const current = (["test", "toolkit", "install", "setup"] as const).find(
      (step) => view.steps[step].state === "running"
    );
    return {
      label: "Running",
      detail: current ? STEP_LABEL[current] : null,
      className: "text-chart-amber",
    };
  }
  const result = view.result;
  const totals = result?.totals
    ? `${result.totals.failed > 0 ? `${result.totals.failed} failed · ` : ""}${result.totals.passed} passed (${result.totals.total})`
    : null;
  const duration = result && result.durationMs > 0 ? formatMs(result.durationMs) : null;
  const detail = [totals, duration].filter(Boolean).join(" · ") || null;
  if (result?.timedOut) return { label: "Timed out", detail, className: "text-brand-orange" };
  if (result?.status === "passed") return { label: "Passed", detail, className: "text-brand-mint" };
  if (result?.status === "failed")
    return { label: "Failed", detail, className: "text-destructive" };
  return { label: "Error", detail: result?.errorMessage ?? detail, className: "text-destructive" };
}

/**
 * 폴더 보기 본문 하단에 붙는 실행 터미널. 접혀 있어도 바는 항상 보이고(마지막 실행 상태 한 줄),
 * 펼치면 onResizeDown/onResizeMove 로 윗선을 끌어 높이를 바꾼다. 높이·접힘 상태는 부모가 들고 있다.
 */
export function RunPanel({
  view,
  open,
  height,
  onToggle,
  onResizeDown,
  onResizeMove,
}: {
  view: RunView | null;
  open: boolean;
  height: number;
  onToggle: () => void;
  onResizeDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeMove: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const status = barStatus(view);
  // 끄는 동안에는 높이 transition 을 끈다. 켜 두면 윗선이 커서를 늦게 따라온다.
  const [resizing, setResizing] = useState(false);
  return (
    <section
      aria-label="Terminal"
      // 접힌 높이(32px)와 펼친 높이 사이를 부드럽게 오간다. 에디터는 automaticLayout 으로 따라 줄어든다.
      style={{ height: open ? height : 32 }}
      className={cn(
        "border-border relative flex max-h-[70%] shrink-0 flex-col overflow-hidden border-t bg-black",
        !resizing && "transition-[height] duration-200 ease-out motion-reduce:transition-none"
      )}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize terminal"
          onPointerDown={(e) => {
            setResizing(true);
            onResizeDown(e);
          }}
          onPointerMove={onResizeMove}
          onPointerUp={() => setResizing(false)}
          onPointerCancel={() => setResizing(false)}
          className="group absolute inset-x-0 -top-1 z-10 flex h-2 cursor-row-resize touch-none items-center"
        >
          <span className="group-hover:bg-brand-orange/70 h-0.5 w-full bg-transparent transition-colors" />
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="border-border bg-sidebar hover:bg-muted/60 flex h-8 w-full shrink-0 items-center gap-2 px-2.5 text-left text-xs transition-colors"
      >
        {/* 접기·펼치기 표시는 왼쪽 끝에 — 오른쪽 끝은 AI 채팅 버튼 근처라 눈에 잘 안 띈다. */}
        <span
          className="bg-brand-orange/15 text-brand-orange flex size-5 shrink-0 items-center justify-center rounded"
          aria-hidden
        >
          <ChevronUp
            className={cn(
              "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </span>
        <span className="font-semibold">Terminal</span>
        <span className={cn("flex min-w-0 items-center gap-1", status.className)}>
          {view?.running && <Loader2 className="size-3 shrink-0 animate-spin" />}
          <span className="shrink-0">{status.label}</span>
          {status.detail && (
            <span className="text-muted-foreground truncate">· {status.detail}</span>
          )}
        </span>
      </button>
      {/* 내용은 접혀도 그대로 두고 투명도만 바꾼다 — 펼칠 때 서서히 나타나고, 접을 때도 높이가 줄어드는
          동안 서서히 사라진다(바로 빼면 빈 검은 영역만 줄어든다). 접힌 동안은 inert 로 탭·스크린리더에서 뺀다. */}
      <div
        inert={!open}
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-opacity duration-200 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {view ? (
          <TerminalBody view={view} />
        ) : (
          <p className="text-muted-foreground border-border flex flex-1 items-center justify-center border-t text-xs">
            Run tests to see the output here.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * 실행 단계(setup→install→toolkit→test)와 러너 출력을 실시간으로 그린다. 폴더 보기의 RunPanel 과
 * 세션 상세 실행 패널이 함께 쓴다 — 접힘·리사이즈 같은 셸은 각자 두고 본문만 공유한다.
 */
/**
 * 저장된 실행 로그(PR 미리보기, 추천 화면의 지난 실행)를 실시간 실행과 같은 터미널로 그린다.
 * 로그에 있는 명령만 단계로 보인다. 샌드박스 준비는 로그가 있다는 것 자체가 끝났다는 뜻이다.
 */
function storedRunView(logs: string): RunView {
  const view = initialView();
  view.running = false;
  const sections = parseStoredRunLog(logs);
  if (sections.length > 0) view.steps.setup = { state: "done", ok: true, ms: null, text: "" };
  for (const section of sections) {
    const prev = view.steps[section.step];
    view.steps[section.step] = {
      state: "done",
      ok: section.exitCode === 0,
      ms: null,
      text: prev.text ? `${prev.text}\n${section.text}` : section.text,
    };
  }
  return view;
}

export function StoredRunLog({ logs }: { logs: string }) {
  const view = useMemo(() => storedRunView(logs), [logs]);
  return <TerminalBody view={view} />;
}

export function TerminalBody({ view }: { view: RunView }) {
  // 설치 로그(레포 의존성·Dante 도구)는 수백 줄이라 접어 둔다. 실패했을 때만 원인을 보라고 펼친다.
  const [installOpen, setInstallOpen] = useState(false);
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const failed = (step: StepView) => step.state === "done" && !step.ok;
  const showInstall = installOpen || failed(view.steps.install);
  const showToolkit = toolkitOpen || failed(view.steps.toolkit);

  // 맨 아래를 보고 있을 때만 새 출력을 따라 내려간다. 위로 올려 읽는 중이면 붙잡지 않는다.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [view]);

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className="border-border min-h-0 flex-1 overflow-auto border-t px-3 py-2 font-mono text-xs leading-relaxed"
      role="log"
      aria-live="polite"
    >
      <StepRow step="setup" view={view.steps.setup} />
      <StepRow
        step="install"
        view={view.steps.install}
        open={showInstall}
        onToggle={() => setInstallOpen((open) => !open)}
      />
      {showInstall && view.steps.install.text && (
        <pre className="text-muted-foreground my-1 pl-5.5 whitespace-pre-wrap">
          <AnsiText text={view.steps.install.text} />
        </pre>
      )}
      <StepRow
        step="toolkit"
        view={view.steps.toolkit}
        open={showToolkit}
        onToggle={() => setToolkitOpen((open) => !open)}
      />
      {showToolkit && view.steps.toolkit.text && (
        <pre className="text-muted-foreground my-1 pl-5.5 whitespace-pre-wrap">
          <AnsiText text={view.steps.toolkit.text} />
        </pre>
      )}
      <StepRow step="test" view={view.steps.test} />
      {view.steps.test.text && (
        <pre className="my-1 pl-5.5 whitespace-pre-wrap">
          <AnsiText text={view.steps.test.text} />
        </pre>
      )}
      {view.result && <Summary result={view.result} />}
    </div>
  );
}
