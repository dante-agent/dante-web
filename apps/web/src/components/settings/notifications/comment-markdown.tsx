"use client";

// PR 코멘트 미리보기를 GitHub 에서 보이는 모양으로 그린다.
//
// 표본 대신 이 프로젝트의 실제 실행이 들어오면 테스트 이름·에러 문구는 사용자 코드에서 온다.
// 그래서 원본 HTML 은 chat-markdown 처럼 skipHtml 로 버리고, 코멘트가 쓰는 HTML 중
// `<details><summary>` 만 여기서 직접 나눠 React 요소로 만든다. rehype-raw 는 넣지 않는다.
// 맨 앞의 마커(`<!-- dante:pr-summary -->`)도 HTML 이라 같이 빠진다 — GitHub 에서도 안 보인다.

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];

const OPEN = "<details><summary>";
const CLOSE = "</details>";

type Part = { kind: "markdown"; text: string } | { kind: "details"; summary: string; body: string };

/**
 * `<details>` 를 바깥 한 겹만 잘라낸다. 안쪽은 body 로 넘겨 다시 이 함수를 태운다.
 *
 * 전부 통과해 한 줄로 접을 때는 접힌 상세 안에 "Components in this PR" 이 또 들어간다.
 * 첫 `</details>` 에서 끊으면 바깥이 안쪽 닫는 태그에서 끝나 버려서, 짝을 세어 닫는 곳을 찾는다.
 */
function splitDetails(markdown: string): Part[] {
  const parts: Part[] = [];
  let rest = markdown;

  for (;;) {
    const open = rest.indexOf(OPEN);
    if (open === -1) break;

    let depth = 1;
    let cursor = open + OPEN.length;
    while (depth > 0) {
      const nextOpen = rest.indexOf(OPEN, cursor);
      const nextClose = rest.indexOf(CLOSE, cursor);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        cursor = nextOpen + OPEN.length;
      } else {
        depth -= 1;
        cursor = nextClose + CLOSE.length;
      }
    }
    // 닫히지 않은 `<details>` 는 comment.ts 가 만들지 않는다. 만나면 나머지를 그냥 마크다운으로 둔다.
    if (depth > 0) break;

    const inner = rest.slice(open + OPEN.length, cursor - CLOSE.length);
    const summaryEnd = inner.indexOf("</summary>");
    parts.push({ kind: "markdown", text: rest.slice(0, open) });
    parts.push({
      kind: "details",
      summary: inner.slice(0, summaryEnd),
      body: inner.slice(summaryEnd + "</summary>".length),
    });
    rest = rest.slice(cursor);
  }

  parts.push({ kind: "markdown", text: rest });
  return parts.filter((part) => part.kind === "details" || part.text.trim());
}

const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h3 className="mt-4 mb-3 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 mb-3 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-3 text-base font-semibold first:mt-0">{children}</h3>
  ),
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground my-3 border-l-2 pl-3">
      {children}
    </blockquote>
  ),
  // 미리보기라 누르면 이동하지 않는다. 링크가 그 자리에 있다는 것만 보이게 모양만 흉내 낸다.
  a: ({ children }) => <span className="text-brand-cobalt">{children}</span>,
  img: ({ alt }) => <span className="text-muted-foreground">[Image{alt ? `: ${alt}` : ""}]</span>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="border-collapse">{children}</table>
    </div>
  ),
  // 요약 표는 머리글이 빈 칸이다. GitHub 은 그 줄을 얇게 그리므로 비었으면 숨긴다.
  thead: ({ children, node }) => {
    const empty = node?.children.every(
      (row) =>
        row.type !== "element" ||
        row.children.every((cell) => cell.type !== "element" || cell.children.length === 0)
    );
    return empty ? null : <thead>{children}</thead>;
  },
  th: ({ children }) => (
    <th className="border-border border px-3 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-border border px-3 py-1.5">{children}</td>,
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
};

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} skipHtml components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
}

function Parts({ markdown }: { markdown: string }) {
  return splitDetails(markdown).map((part, index) =>
    part.kind === "markdown" ? (
      <Markdown key={index} text={part.text} />
    ) : (
      <details key={index} className="my-3 first:mt-0 last:mb-0">
        <summary className="cursor-pointer">{part.summary}</summary>
        <div className="mt-3">
          <Parts markdown={part.body} />
        </div>
      </details>
    )
  );
}

/** 코멘트 본문. GitHub 처럼 `<details>` 는 접힌 채로 시작한다. */
export function CommentMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="text-[13px] leading-relaxed wrap-break-word">
      <Parts markdown={markdown} />
    </div>
  );
}
