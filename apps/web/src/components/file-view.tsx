"use client";

// 폴더 보기 본문. view = 소스|테스트 2-pane(구분선 드래그로 비율 조절), edit = 테스트 Before|After DiffEditor.
// Monaco 는 SSR 에서 깨져 dynamic({ ssr:false }) (AGENTS.md). 데이터는 목업(content).

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Monaco } from "@monaco-editor/react";
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
import { iconForFile } from "@/components/file-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { pushRecent } from "@/lib/recent-files";
import { cn } from "@/lib/utils";

type FileContent = { source: string; test: string | null; testDraft: string | null };

const Fallback = () => (
  <div className="flex h-full items-center justify-center bg-black">
    <Loader2 className="text-muted-foreground size-5 animate-spin" />
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

const THEME = "dante-black";

const setupMonaco = (monaco: Monaco) => {
  monaco.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#000000",
      "editorGutter.background": "#000000",
      "editorLineNumber.background": "#000000",
      "diffEditor.insertedLineBackground": "#132a1c",
      "diffEditor.removedLineBackground": "#331a1c",
      "diffEditor.insertedTextBackground": "#2ea04340",
      "diffEditor.removedTextBackground": "#f8514940",
      "diffEditor.border": "#00000000",
    },
  });
  // 목업 코드 뷰어 — 미설치 모듈("vitest" 등) 진단 안 띄운다.
  const diag = { noSemanticValidation: true, noSuggestionDiagnostics: true };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diag);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diag);
};

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

/** 테스트 파일이 아직 없을 때 표시용 이름. `src/lib/format.ts` → `format.test.ts` */
function guessTestName(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? `${base}.test` : `${base.slice(0, dot)}.test${base.slice(dot)}`;
}

function CodePane({ lang, value }: { lang: string; value: string }) {
  return (
    <Editor
      language={lang}
      theme={THEME}
      beforeMount={setupMonaco}
      loading={<Fallback />}
      value={value}
      options={OPTIONS}
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
  const copy = () => void navigator.clipboard.writeText(text).catch(() => {});
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
        title="다운로드"
        aria-label="다운로드"
      >
        <Download />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={copy}
        title="전체 복사"
        aria-label="전체 복사"
      >
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

const GRID =
  "border-border relative grid h-[calc(100svh-47px)] grid-cols-2 grid-rows-[2.25rem_2.25rem_minmax(0,1fr)] overflow-hidden";

function FileHeading({ name }: { name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {iconForFile(name.split("/").pop() ?? name, { className: "size-3.5 shrink-0" })}
      <span className="truncate font-mono font-semibold">{name}</span>
    </span>
  );
}

function ExpandButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={onToggle}
      title={active ? "복원" : "확대"}
      aria-label={active ? "복원" : "확대"}
    >
      {active ? <Minimize2 /> : <Maximize2 />}
    </Button>
  );
}

function DragDivider({
  pct,
  onDown,
  onMove,
}: {
  pct: number;
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onDown}
      onPointerMove={onMove}
      style={{ left: `${pct}%` }}
      className="group absolute inset-y-0 z-10 flex w-2 -translate-x-1/2 cursor-col-resize touch-none justify-center"
    >
      <span className="group-hover:bg-brand-orange/70 h-full w-0.5 rounded-full bg-transparent transition-colors" />
    </div>
  );
}

export function FileView({
  file,
  mode,
  projectRef,
  testPath,
  content,
}: {
  file: string;
  mode: "view" | "edit";
  projectRef: string;
  testPath: string | null;
  content: FileContent;
}) {
  const pathname = usePathname();
  const lang = langOf(file);
  const viewHref = `${pathname}?file=${encodeURIComponent(file)}`;
  const editHref = `${viewHref}&mode=edit`;
  const testName = testPath?.split("/").pop() ?? guessTestName(file);

  useEffect(() => {
    pushRecent(projectRef, file);
  }, [projectRef, file]);

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

  const [expanded, setExpanded] = useState<null | "left" | "right">(null);
  const toggle = (s: "left" | "right") => setExpanded((e) => (e === s ? null : s));
  const showLeft = expanded !== "right";
  const showRight = expanded !== "left";
  const expandedCols = expanded ? "minmax(0,1fr)" : undefined;

  if (mode === "edit") {
    const original = content.test ?? "";
    const draft = content.testDraft ?? original;

    return (
      <div className={GRID} style={{ gridTemplateColumns: expandedCols }}>
        <Cell show={showLeft} className="bg-sidebar flex items-center border-b px-2.5 text-xs">
          <span className="font-semibold">Before</span>
        </Cell>
        <Cell show={showRight} className="bg-sidebar flex items-center border-b px-2.5 text-xs">
          <span className="font-semibold">After</span>
          <div className="ml-auto flex items-center gap-1">
            <Link href={viewHref} className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}>
              Cancel
            </Link>
            {/* ponytail: 저장 동작은 다음 PR */}
            <Button variant="ghost" size="xs" disabled className="text-brand-orange">
              Save
            </Button>
            <span className="bg-border mx-0.5 h-4 w-px" />
            {/* ponytail: 되돌리기(After→원본) 다음 PR */}
            <Button size="icon-sm" variant="ghost" disabled title="되돌리기" aria-label="되돌리기">
              <RotateCcw />
            </Button>
            {/* ponytail: AI (재)생성 다음 PR */}
            <Button
              size="icon-sm"
              variant="ghost"
              disabled
              title="AI 생성"
              aria-label="AI 생성"
              className="text-brand-orange"
            >
              <Sparkles />
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
            text={draft}
            filename={testName}
            trailing={
              <ExpandButton active={expanded === "right"} onToggle={() => toggle("right")} />
            }
          />
        </Cell>

        <div className={cn("min-h-0 bg-black", !expanded && "col-span-2")}>
          {expanded === "left" ? (
            <CodePane lang={lang} value={original} />
          ) : expanded === "right" ? (
            <Editor
              language={lang}
              theme={THEME}
              beforeMount={setupMonaco}
              loading={<Fallback />}
              value={draft}
              options={{ ...OPTIONS, readOnly: false }}
            />
          ) : (
            <DiffEditor
              language={lang}
              theme={THEME}
              beforeMount={setupMonaco}
              loading={<Fallback />}
              original={original}
              modified={draft}
              options={{
                ...OPTIONS,
                readOnly: false,
                originalEditable: false,
                renderSideBySide: true,
                renderSideBySideInlineBreakpoint: 0,
                useInlineViewWhenSpaceIsLimited: false,
                enableSplitViewResizing: false,
                overviewRulerBorder: false,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  const cols = expanded ? "minmax(0,1fr)" : `minmax(0,${leftPct}fr) minmax(0,${100 - leftPct}fr)`;

  return (
    <div ref={gridRef} className={GRID} style={{ gridTemplateColumns: cols }}>
      <Cell
        show={showLeft}
        className={cn(
          "bg-sidebar flex items-center border-b px-2.5 text-xs",
          showRight && "border-r"
        )}
      >
        <span className="font-semibold">Source Code</span>
      </Cell>
      <Cell
        show={showRight}
        className="bg-sidebar flex items-center gap-1.5 border-b px-2.5 text-xs"
      >
        <span className="font-semibold">Test Code</span>
        {content.test && (
          <div className="ml-auto flex items-center gap-0.5">
            {/* ponytail: 실행 동작은 runner PR */}
            <Button
              size="icon-sm"
              variant="ghost"
              disabled
              title="Run"
              aria-label="Run"
              className="text-brand-orange"
            >
              <Play />
            </Button>
            <Link
              href={editHref}
              title="편집"
              aria-label="편집"
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
            <ReadOnlyBadge />
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
        <CodePane lang={lang} value={content.source} />
      </Cell>
      <Cell show={showRight} className="bg-black">
        {content.test ? (
          <CodePane lang={lang} value={content.test} />
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm">아직 테스트가 없습니다.</p>
            <Button size="sm" disabled>
              테스트 생성
            </Button>
          </div>
        )}
      </Cell>

      {!expanded && <DragDivider pct={leftPct} onDown={onDividerDown} onMove={onDividerMove} />}
    </div>
  );
}
