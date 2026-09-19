"use client";

// 폴더 보기 본문. view = 소스|테스트 2-pane(구분선 드래그로 비율 조절), edit = 테스트 Before|After DiffEditor.
// Monaco 는 SSR 에서 깨져 dynamic({ ssr:false }) (AGENTS.md).

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { OnMount } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Copy,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { generateFolderTest, saveTestEdit } from "@/app/project/[projectRef]/folder/actions";
import { useReportCurrentTest } from "@/components/ai-chat";
import { iconForFile } from "@/components/file-icons";
import { CodeSkeleton } from "@/components/generation/code-skeleton";
import { GenerationSteps } from "@/components/generation/generation-steps";
import { SendingFiles } from "@/components/generation/sending-files";
import { onTestApplyRequest, provideAfterCode } from "@/components/generation/test-apply-request";
import { onTestTypingRequest } from "@/components/generation/test-typing-request";
import {
  useGenerationPerformance,
  type GenerationOutcome,
} from "@/components/generation/use-generation-performance";
import { useTypewriter } from "@/components/generation/use-typewriter";
import { copyAndAnnounce } from "@/components/live-announcer";
import { onTestRunRequest, RunPanel, useLiveRun } from "@/components/run-terminal";
import { Button, buttonVariants } from "@/components/ui/button";
import { useElementSize, useResizeHandle } from "@/components/use-resize-handle";
import { MONACO_THEME as THEME, setupMonaco } from "@/lib/monaco-theme";
import { pushRecent } from "@/lib/recent-files";
import { cn } from "@/lib/utils";

type FileContent = { source: string; test: string | null; testDraft: string | null };
/** Test Code 칸이 레포 파일이 아니라 Dante 에 저장된 버전일 때. source 는 "ai" | "user". */
type Draft = { version: number; source: string };

const Fallback = () => (
  <div role="status" className="flex h-full items-center justify-center bg-black">
    <Loader2 className="text-muted-foreground size-5 animate-spin" />
    <span className="sr-only">Loading editor…</span>
  </div>
);

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: Fallback,
});
const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), {
  ssr: false,
  loading: Fallback,
});

const OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 12 },
} as const;

function langOf(path: string): string {
  const ext = path.split(".").pop();
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "javascript";
  return "plaintext";
}

/**
 * Monaco 모델 경로. 두 가지를 동시에 푼다.
 * - 확장자가 있어야 TS 가 .tsx 를 TSX 로 읽는다. 없으면 JSX 를 전부 문법 오류로 찍는다.
 * - 칸마다 달라야 한다. 같은 경로면 Before|After 가 모델을 공유해 한쪽을 고치면 양쪽이 바뀐다.
 */
const modelPath = (role: string, path: string) => `file:///${role}/${path}`;

/** 테스트 파일이 아직 없을 때 표시용 이름. `src/lib/format.ts` → `format.test.ts` */
function guessTestName(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? `${base}.test` : `${base.slice(0, dot)}.test${base.slice(dot)}`;
}

function CodePane({
  label,
  lang,
  path,
  value,
  follow = false,
}: {
  /** 스크린리더가 읽는 에디터 이름("Source: src/foo.ts"). 없으면 모든 에디터가 "Editor content" 다. */
  label: string;
  lang: string;
  /** 이 칸만의 모델 경로(modelPath). 확장자로 TSX 여부가 갈린다. */
  path: string;
  value: string;
  /** 내용이 늘어날 때마다 마지막 줄로 스크롤한다 — 생성 연출에서 코드가 써지는 걸 따라간다. */
  follow?: boolean;
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  useEffect(() => {
    const lines = editorRef.current?.getModel()?.getLineCount();
    if (follow && lines) editorRef.current?.revealLine(lines);
  }, [follow, value]);

  return (
    <Editor
      language={lang}
      path={path}
      theme={THEME}
      beforeMount={setupMonaco}
      loading={<Fallback />}
      value={value}
      options={{ ...OPTIONS, ariaLabel: label }}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
    />
  );
}

function FileActions({
  text,
  filename,
  trailing,
}: {
  text: string;
  filename: string;
  trailing?: ReactNode;
}) {
  const copy = () => void copyAndAnnounce(text);
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="ml-auto flex items-center gap-0.5">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={download}
        title="Download"
        aria-label="Download"
      >
        <Download />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={copy} title="Copy all" aria-label="Copy all">
        <Copy />
      </Button>
      {trailing}
    </div>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
      Read-only
    </span>
  );
}

function DraftBadge({ draft }: { draft: Draft }) {
  const edited = draft.source === "user";
  return (
    <span
      title={`${edited ? "Edited" : "Generated by AI"} and saved in Dante. Not committed to the repository.`}
      className="bg-brand-orange/10 text-brand-orange shrink-0 rounded px-1 py-0.5 text-[10px]"
    >
      {edited ? "Edited" : "AI draft"} · v{draft.version}
    </span>
  );
}

const GENERATE_ERROR: Record<"budget" | "not-found" | "error", string> = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  "not-found": "Couldn't read this file from the repository. Refresh and try again.",
  error: "Test generation failed. Please try again in a moment.",
};

/**
 * 테스트가 없을 때의 빈 칸. Generate 를 누르면 추천 생성 화면과 같은 연출을 이 칸에서 보여준다:
 * 위엔 파일을 AI 로 보내는 모습과 단계, 아래엔 스켈레톤 → 받은 코드가 써지는 에디터.
 * 다 쓰면 router.refresh() 로 저장된 버전을 읽어 와 이 칸이 일반 Test Code 보기로 바뀐다.
 */
function GenerateTest({ projectRef, file }: { projectRef: string; file: string }) {
  const router = useRouter();

  const generate = useCallback(async (): Promise<GenerationOutcome<{ code: string }>> => {
    const result = await generateFolderTest(projectRef, file);
    return result.ok
      ? { ok: true, files: [{ code: result.code }] }
      : { ok: false, message: GENERATE_ERROR[result.reason] };
  }, [projectRef, file]);
  const finish = useCallback(() => router.refresh(), [router]);

  const { stage, files, typing, error, start } = useGenerationPerformance<{ code: string }>({
    finish,
  });

  if (stage === null || stage === "error") {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm">No tests yet.</p>
        <Button size="sm" onClick={() => start(generate)}>
          <Sparkles data-icon="inline-start" />
          Generate tests
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border bg-background flex shrink-0 flex-col gap-3 border-b p-3">
        <SendingFiles files={[file]} stage={stage} />
        <GenerationSteps stage={stage} finalLabel="Showing the test" />
      </div>
      {files ? (
        <div className="min-h-0 flex-1">
          <CodePane
            label={`Generated test for ${file}`}
            lang={langOf(file)}
            path={modelPath("generating", guessTestName(file))}
            value={files[0].code.slice(0, typing.chars)}
            follow
          />
        </div>
      ) : (
        <CodeSkeleton pulsing={stage === "write"} />
      )}
    </div>
  );
}

function Cell({
  className,
  show = true,
  children,
}: {
  className?: string;
  show?: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return <div className={cn("border-border min-w-0", className)}>{children}</div>;
}

/** 채팅의 타이핑 요청 뒤 이 시간 안에 테스트가 바뀌어야 연출한다(새로 읽어 오는 데 걸리는 시간 여유). */
const TYPING_REQUEST_WINDOW_MS = 15_000;

/** 본문 높이. 헤더 47px 만 빼면 화면 끝까지. */
const PANE_HEIGHT = "h-[calc(100svh-47px)]";
const GRID =
  "border-border relative grid grid-cols-2 grid-rows-[2.25rem_2.25rem_minmax(0,1fr)] overflow-hidden";

/** 터미널을 펼쳤을 때 높이(px). 끌어서 바꾸되 이 범위 안에서만. 최대는 본문의 70%. */
const TERMINAL_DEFAULT = 320;
const TERMINAL_MIN = 120;

function FileHeading({ name }: { name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {iconForFile(name.split("/").pop() ?? name, { className: "size-3.5 shrink-0" })}
      <span className="truncate font-mono font-semibold">{name}</span>
    </span>
  );
}

function ExpandButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  // 이름은 고정하고 상태는 aria-pressed 로 — 이름이 Expand ↔ Restore 로 바뀌면 눌렸는지 알 수 없다.
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={onToggle}
      title={active ? "Restore" : "Expand"}
      aria-label="Expand"
      aria-pressed={active}
    >
      {active ? <Minimize2 /> : <Maximize2 />}
    </Button>
  );
}

function DragDivider({
  pct,
  handle,
  onDown,
  onMove,
}: {
  pct: number;
  /** 키보드 조작·aria-value* (useResizeHandle). */
  handle: ReturnType<typeof useResizeHandle>;
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      {...handle}
      onPointerDown={onDown}
      onPointerMove={onMove}
      style={{ left: `${pct}%` }}
      className="group absolute inset-y-0 z-10 flex w-2 -translate-x-1/2 cursor-col-resize touch-none justify-center outline-none"
    >
      <span className="group-hover:bg-brand-orange/70 group-focus-visible:bg-brand-orange h-full w-0.5 rounded-full bg-transparent transition-colors" />
    </div>
  );
}

export function FileView({
  file,
  mode,
  projectRef,
  testPath,
  draft = null,
  versionId = null,
  terminal = false,
  saveable = false,
  content,
}: {
  file: string;
  mode: "view" | "edit";
  projectRef: string;
  testPath: string | null;
  /** Test Code 가 레포에서 가져온 그대로가 아니라 Dante 에서 만들거나 고친 버전이면 그 정보. */
  draft?: Draft | null;
  /** Test Code 칸에 보이는 저장된 버전의 id. 있으면 Run 으로 돌릴 수 있다. */
  versionId?: string | null;
  /** 하단 실행 터미널 바를 붙일지. 폴더 보기만 켠다(PR 화면은 실행이 없다). */
  terminal?: boolean;
  /** 수정 모드의 Save 로 테스트를 새 버전으로 저장할 수 있는지. 폴더 보기만 켠다(PR 테스트는 버전이 없다). */
  saveable?: boolean;
  content: FileContent;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const lang = langOf(file);
  const viewHref = `${pathname}?file=${encodeURIComponent(file)}`;
  const editHref = `${viewHref}&mode=edit`;
  const testName = testPath?.split("/").pop() ?? guessTestName(file);

  useEffect(() => {
    pushRecent(projectRef, file);
  }, [projectRef, file]);
  useReportCurrentTest(content.test);

  const gridRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(50);
  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDividerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !gridRef.current) return;
    const r = gridRef.current.getBoundingClientRect();
    setLeftPct(Math.min(80, Math.max(20, ((e.clientX - r.left) / r.width) * 100)));
  };
  const dividerHandle = useResizeHandle({
    label: "Resize source and test panes",
    orientation: "vertical",
    value: leftPct,
    min: 20,
    max: 80,
    step: 5,
    onChange: setLeftPct,
  });

  // AI 채팅이 테스트를 고치면 새로 읽어 온 코드를 Test Code 칸에 타이핑 연출로 보여준다.
  // 요청(이벤트)을 받으면 대기 상태로 두고, 곧이어 테스트 내용이 바뀌면 그 내용을 재생한다.
  // 저장·생성처럼 요청 없이 바뀐 경우엔 재생하지 않는다(생성은 자체 연출이 이미 끝났다).
  const typer = useTypewriter();
  const [typingArmed, setTypingArmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onTestTypingRequest(file, () => {
      setTypingArmed(true);
      // 내용이 그대로라 바뀌지 않으면 나중의 다른 변경(저장 등)에 재생하지 않도록 풀어 둔다.
      clearTimeout(timer);
      timer = setTimeout(() => setTypingArmed(false), TYPING_REQUEST_WINDOW_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [file]);
  // 바뀐 내용은 렌더 중에 바로 재생을 건다 — effect 로 미루면 새 코드가 한 번 통째로 보였다가 지워진다.
  const [lastTest, setLastTest] = useState(content.test);
  if (lastTest !== content.test) {
    setLastTest(content.test);
    if (typingArmed) {
      setTypingArmed(false);
      if (content.test) typer.play(content.test);
    }
  }

  // 실행 상태는 파일마다 따로다(부모가 key={file} 로 새로 띄운다). 파일을 옮기면 실행도 멈춘다.
  const run = useLiveRun(projectRef);
  // 하단 터미널. 접혀 있어도 바는 보인다. Run 을 누르면 펼친다.
  const shellRef = useRef<HTMLDivElement>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(TERMINAL_DEFAULT);
  // AI 채팅의 "실행해줘". 터미널은 보기 모드에만 있으니 수정 중에는 받지 않는다.
  const { start } = run;
  useEffect(() => {
    if (!terminal || mode !== "view") return;
    return onTestRunRequest(file, (id) => {
      setTerminalOpen(true);
      void start(id);
    });
  }, [terminal, mode, file, start]);
  // ⌘/Ctrl+J 로 여닫는다(VS Code 의 패널 토글과 같은 키). 서브 사이드바의 ⌘B 와 같은 방식으로
  // capture 단계에서 받는다 — Monaco 가 먼저 키를 삼키지 못하게.
  useEffect(() => {
    if (!terminal || mode !== "view") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.repeat) return;
      if (e.key.toLowerCase() !== "j") return;
      e.preventDefault();
      setTerminalOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [terminal, mode]);
  const onTerminalResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onTerminalResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !shellRef.current) return;
    const r = shellRef.current.getBoundingClientRect();
    setTerminalHeight(Math.min(r.height * 0.7, Math.max(TERMINAL_MIN, r.bottom - e.clientY)));
  };
  const shellSize = useElementSize(shellRef);
  const terminalHandle = useResizeHandle({
    label: "Resize terminal",
    orientation: "horizontal",
    value: terminalHeight,
    min: TERMINAL_MIN,
    max: shellSize.height * 0.7,
    step: 24,
    onChange: setTerminalHeight,
    grow: "backward",
  });

  const [expanded, setExpanded] = useState<null | "left" | "right">(null);
  const toggle = (s: "left" | "right") => setExpanded((e) => (e === s ? null : s));
  const showLeft = expanded !== "right";
  const showRight = expanded !== "left";
  const expandedCols = expanded ? "minmax(0,1fr)" : undefined;

  // 수정 모드의 After. 들어올 때마다 지금 저장된 테스트에서 시작한다 — 보기 ↔ 수정은 같은
  // 컴포넌트라(key 는 파일) 상태가 남는데, 그 사이 Save·채팅으로 내용이 바뀌었을 수 있다.
  const original = content.test ?? "";
  const [editing, setEditing] = useState(content.testDraft ?? original);
  const [saveError, setSaveError] = useState(false);
  const [editMode, setEditMode] = useState(mode);
  if (editMode !== mode) {
    setEditMode(mode);
    if (mode === "edit") {
      setEditing(content.testDraft ?? original);
      setSaveError(false);
    }
  }
  // 수정 중인 내용을 채팅이 물어볼 수 있게 열어 둔다. ref 로 읽는 이유는 등록을 글자마다
  // 다시 하지 않으려는 것이다 — 채팅은 보낼 때 한 번만 읽는다.
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    if (mode !== "edit") return;
    return provideAfterCode(() => editingRef.current);
  }, [mode]);

  // 채팅 답의 Apply. 저장하지 않고 After 칸만 채운다 — 잘못 눌렀으면 ⌘Z 로 되돌아간다.
  useEffect(() => {
    if (mode !== "edit") return;
    return onTestApplyRequest(file, setEditing);
  }, [mode, file]);

  const dirty = editing !== original;
  const [saving, startSaving] = useTransition();

  const saveEdit = () =>
    startSaving(async () => {
      setSaveError(false);
      try {
        const result = await saveTestEdit(projectRef, file, editing);
        if (!result.ok) return setSaveError(true);
        // 액션이 refresh 로 새 버전을 읽어 두었다. 보기 모드로 돌아가면 Test Code 칸에 바로 보인다.
        router.replace(viewHref);
      } catch {
        setSaveError(true);
      }
    });

  if (mode === "edit") {
    return (
      <div className={cn(GRID, PANE_HEIGHT)} style={{ gridTemplateColumns: expandedCols }}>
        {/* 화면 제목. sr-only 는 absolute 라 그리드 칸을 차지하지 않는다. */}
        <h1 className="sr-only">Edit test: {testName}</h1>
        <Cell show={showLeft} className="bg-sidebar flex items-center border-b px-2.5 text-xs">
          <h2 className="font-semibold">Before</h2>
        </Cell>
        <Cell show={showRight} className="bg-sidebar flex items-center border-b px-2.5 text-xs">
          <h2 className="font-semibold">After</h2>
          <div className="ml-auto flex items-center gap-1">
            {saveError && (
              <span role="alert" className="text-destructive mr-1 text-xs">
                Couldn&apos;t save. Try again.
              </span>
            )}
            <Link href={viewHref} className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}>
              Cancel
            </Link>
            {/* 바뀐 게 없으면 막는다 — 같은 내용이 새 버전으로 또 쌓인다. */}
            <Button
              variant="ghost"
              size="xs"
              onClick={saveEdit}
              disabled={!saveable || !dirty || saving}
              // 누르면 바로 막힌다. 포커스를 잃지 않게 aria-disabled 로 막는다.
              focusableWhenDisabled
              className="text-brand-orange"
            >
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
            <span className="bg-border mx-0.5 h-4 w-px" />
            {/* 저장 전 편집만 되돌린다(After = Before). 저장된 버전은 건드리지 않는다. */}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(original)}
              disabled={!dirty || saving}
              focusableWhenDisabled
              title="Revert changes"
              aria-label="Revert changes"
            >
              <RotateCcw />
            </Button>
          </div>
        </Cell>

        <Cell
          show={showLeft}
          className="bg-sidebar flex items-center gap-2.5 border-b px-2.5 text-xs"
        >
          <FileHeading name={testName} />
          <ReadOnlyBadge />
          <FileActions
            text={original}
            filename={testName}
            trailing={<ExpandButton active={expanded === "left"} onToggle={() => toggle("left")} />}
          />
        </Cell>
        <Cell
          show={showRight}
          className="bg-sidebar flex items-center gap-2.5 border-b px-2.5 text-xs"
        >
          <FileHeading name={testName} />
          <FileActions
            text={editing}
            filename={testName}
            trailing={
              <ExpandButton active={expanded === "right"} onToggle={() => toggle("right")} />
            }
          />
        </Cell>

        <div className={cn("min-h-0 bg-black", !expanded && "col-span-2")}>
          {expanded === "left" ? (
            <CodePane
              label={`Before: ${testName}`}
              lang={lang}
              path={modelPath("before", testName)}
              value={original}
            />
          ) : expanded === "right" ? (
            <Editor
              language={lang}
              path={modelPath("after", testName)}
              theme={THEME}
              beforeMount={setupMonaco}
              loading={<Fallback />}
              value={editing}
              onChange={(value) => setEditing(value ?? "")}
              // 쓰기 가능한 에디터에서는 Tab 이 들여쓰기라 빠져나가는 방법을 이름에 함께 알린다.
              options={{
                ...OPTIONS,
                readOnly: false,
                ariaLabel: `After: ${testName}. Press Ctrl+M (Ctrl+Shift+M on Mac) to move focus with Tab.`,
              }}
            />
          ) : (
            <DiffEditor
              language={lang}
              theme={THEME}
              beforeMount={setupMonaco}
              loading={<Fallback />}
              originalModelPath={modelPath("before", testName)}
              modifiedModelPath={modelPath("after", testName)}
              original={original}
              modified={editing}
              // DiffEditor 에는 onChange 가 없다. 오른쪽(After) 에디터에 직접 붙인다.
              onMount={(editor) => {
                const after = editor.getModifiedEditor();
                after.onDidChangeModelContent(() => setEditing(after.getValue()));
              }}
              options={{
                ...OPTIONS,
                readOnly: false,
                originalEditable: false,
                renderSideBySide: true,
                renderSideBySideInlineBreakpoint: 0,
                useInlineViewWhenSpaceIsLimited: false,
                enableSplitViewResizing: false,
                overviewRulerBorder: false,
                originalAriaLabel: `Before: ${testName}`,
                modifiedAriaLabel: `After: ${testName}. Press Ctrl+M (Ctrl+Shift+M on Mac) to move focus with Tab.`,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  const cols = expanded ? "minmax(0,1fr)" : `minmax(0,${leftPct}fr) minmax(0,${100 - leftPct}fr)`;

  return (
    <div ref={shellRef} className={cn("flex flex-col", PANE_HEIGHT)}>
      <h1 className="sr-only">{file}</h1>
      <div
        ref={gridRef}
        className={cn(GRID, "min-h-0 flex-1")}
        style={{ gridTemplateColumns: cols }}
      >
        <Cell
          show={showLeft}
          className={cn(
            "bg-sidebar flex items-center border-b px-2.5 text-xs",
            showRight && "border-r"
          )}
        >
          <h2 className="font-semibold">Source Code</h2>
        </Cell>
        <Cell
          show={showRight}
          className="bg-sidebar flex items-center gap-1.5 border-b px-2.5 text-xs"
        >
          <h2 className="font-semibold">Test Code</h2>
          {content.test && (
            <div className="ml-auto flex items-center gap-0.5">
              {/* 실행은 저장된 버전(레포에서 가져온 것·AI draft 모두)을 돌린다. 한 번에 하나만. */}
              {versionId && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setTerminalOpen(true);
                    void run.start(versionId);
                  }}
                  disabled={run.view?.running}
                  title={run.view?.running ? "Running…" : "Run tests"}
                  aria-label="Run tests"
                  className="text-brand-orange"
                >
                  {run.view?.running ? <Loader2 className="animate-spin" /> : <Play />}
                </Button>
              )}
              {/* 레포에서 온 테스트든 Dante 에서 만든 테스트든 고칠 수 있다. Before 는 지금 저장된 내용이다. */}
              <Link
                href={editHref}
                title="Edit"
                aria-label="Edit"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "text-brand-orange hover:bg-brand-orange/10 hover:text-brand-orange"
                )}
              >
                <Pencil />
              </Link>
            </div>
          )}
        </Cell>

        <Cell
          show={showLeft}
          className={cn(
            "bg-sidebar flex items-center gap-2.5 border-b px-2.5 text-xs",
            showRight && "border-r"
          )}
        >
          <FileHeading name={file} />
          <ReadOnlyBadge />
          <FileActions
            text={content.source}
            filename={file.split("/").pop() ?? "source.txt"}
            trailing={<ExpandButton active={expanded === "left"} onToggle={() => toggle("left")} />}
          />
        </Cell>
        <Cell
          show={showRight}
          className="bg-sidebar flex items-center gap-2.5 border-b px-2.5 text-xs"
        >
          {content.test && (
            <>
              <FileHeading name={testName} />
              {draft === null ? <ReadOnlyBadge /> : <DraftBadge draft={draft} />}
              <FileActions
                text={content.test}
                filename={testName}
                trailing={
                  <ExpandButton active={expanded === "right"} onToggle={() => toggle("right")} />
                }
              />
            </>
          )}
        </Cell>

        <Cell show={showLeft} className={cn("bg-black", showRight && "border-r")}>
          <CodePane
            label={`Source: ${file}`}
            lang={lang}
            path={modelPath("source", file)}
            value={content.source}
          />
        </Cell>
        <Cell show={showRight} className="bg-black">
          {content.test ? (
            <CodePane
              label={`Test: ${testName}`}
              lang={lang}
              path={modelPath("test", testName)}
              value={typer.shown ?? content.test}
              follow={typer.shown !== null}
            />
          ) : (
            <GenerateTest projectRef={projectRef} file={file} />
          )}
        </Cell>

        {!expanded && (
          <DragDivider
            pct={leftPct}
            handle={dividerHandle}
            onDown={onDividerDown}
            onMove={onDividerMove}
          />
        )}
      </div>
      {terminal && (
        <RunPanel
          view={run.view}
          open={terminalOpen}
          height={terminalHeight}
          onToggle={() => setTerminalOpen((open) => !open)}
          resizeHandle={terminalHandle}
          onResizeDown={onTerminalResizeDown}
          onResizeMove={onTerminalResizeMove}
        />
      )}
    </div>
  );
}
