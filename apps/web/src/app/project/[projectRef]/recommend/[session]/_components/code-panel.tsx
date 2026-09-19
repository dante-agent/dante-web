"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import type { MonacoDiffEditor } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import { copyAndAnnounce } from "@/components/live-announcer";
import { MONACO_THEME as THEME, setupMonaco } from "@/lib/monaco-theme";
import type { SessionDetail } from "../session-detail";

// 우측 "Code" 패널 — 생성된 테스트 코드를 Monaco 로 보여준다(읽기 전용, 구문 강조).
// 폴더 보기(file-view)와 같은 설정을 쓴다: SSR 에서 깨져 dynamic({ ssr:false }), 같은 테마.
//
// 새로 만드는 파일이라 전 줄이 "추가"다. 그 초록 하이라이트를 살리려고 DiffEditor 를 인라인으로
// 쓰고 original 을 빈 문자열로 둔다 — 모든 줄이 insert 로 잡혀 테마의 초록 배경이 깔린다.
const Fallback = () => (
  <div className="flex h-full items-center justify-center bg-black">
    <Loader2 className="text-muted-foreground size-5 animate-spin" />
  </div>
);

const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), {
  ssr: false,
  loading: Fallback,
});

const OPTIONS = {
  readOnly: true,
  originalEditable: false,
  renderSideBySide: false,
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

export function CodePanel({
  code,
  content,
  follow = false,
}: {
  code: SessionDetail["code"];
  content: string;
  /** 내용이 늘어날 때마다 마지막 줄로 스크롤한다 — 생성 화면의 "코드가 써지는" 연출용. */
  follow?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<MonacoDiffEditor | null>(null);

  useEffect(() => {
    const editor = editorRef.current?.getModifiedEditor();
    const lines = editor?.getModel()?.getLineCount();
    if (follow && editor && lines) editor.revealLine(lines);
  }, [follow, content]);

  const copy = async () => {
    // 결과는 스크린리더에도 알린다(실패 포함). 화면 표시는 성공일 때만 바뀐다.
    if (!(await copyAndAnnounce(content))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="bg-background flex min-w-0 flex-1 flex-col">
      {/* 파일 행 */}
      <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-4">
        <span className="text-brand-cobalt font-mono text-xs font-semibold">{code.changeType}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={code.path}>
          {code.path}
        </span>
        {code.additions > 0 && (
          <span className="font-mono text-xs text-emerald-400">+{code.additions}</span>
        )}
        {code.deletions > 0 && (
          <span className="font-mono text-xs text-red-400">-{code.deletions}</span>
        )}
        <button
          type="button"
          onClick={copy}
          className="text-muted-foreground hover:text-foreground ml-1 flex items-center gap-1"
          aria-label="Copy code"
        >
          {copied ? <Check className="text-brand-mint size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      {/* 에디터 본문 — original="" 이라 전 줄이 초록(insert)으로 보인다. */}
      <div className="min-h-0 flex-1">
        <DiffEditor
          language={langOf(code.path)}
          theme={THEME}
          beforeMount={setupMonaco}
          loading={<Fallback />}
          original=""
          modified={content}
          options={OPTIONS}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>
    </section>
  );
}
