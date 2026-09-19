import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { splitMarkdownBlocks } from "./markdown-blocks.ts";

// 블록으로 나눠 따로 그린 결과가 통째로 그린 것과 같은지 본다. 실행: pnpm --filter @dante/web test

const render = (text: string) =>
  renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], skipHtml: true }, text)
  )
    // 블록 사이 줄바꿈 글자 노드는 따로 그리면 빠진다. 블록 요소 사이라 화면엔 안 보인다.
    .replace(/>\n</g, "><");

const same = (text: string) =>
  assert.equal(splitMarkdownBlocks(text).map(render).join(""), render(text), text);

const ANSWER = [
  "## Tests for Button",
  "Here is **what** changed:",
  "- first item\n- second item\n\n- loose item\n  continued",
  "1. one\n2. two",
  "> quoted\n\n> another quote",
  "| a | b |\n| - | - |\n| 1 | 2 |",
  "```ts\nimport { x } from './x';\n\nconst a = 1;\n\n\nexport {};\n```",
  "Indented code:\n\n    const x = 1;\n\n    const y = 2;",
  "~~~\nplain\n\n~~~",
  "Setext\n===",
  "---",
  "Final paragraph with `inline` code.",
].join("\n\n");

describe("스트리밍 답 블록 나누기", () => {
  it("완성된 답을 나눠 그려도 통째로 그린 것과 같다", () => {
    same(ANSWER);
    assert.ok(splitMarkdownBlocks(ANSWER).length > 5);
  });

  it("스트리밍 중 어느 지점에서 잘려도 같다(열린 코드블록 포함)", () => {
    for (let end = 1; end <= ANSWER.length; end++) same(ANSWER.slice(0, end));
  });

  it("코드펜스 안의 빈 줄에서는 나누지 않는다", () => {
    const text = "Intro\n\n```ts\nconst a = 1;\n\nconst b = 2;";
    assert.deepEqual(splitMarkdownBlocks(text), ["Intro", "```ts\nconst a = 1;\n\nconst b = 2;"]);
  });

  it("참조 링크·각주·HTML 이 있으면 나누지 않는다", () => {
    for (const text of [
      "See [docs][d].\n\nMore.\n\n[d]: https://example.com",
      "Claim[^1].\n\nMore.\n\n[^1]: Source",
      "<!--\n\nhidden\n\n-->\n\nText",
    ]) {
      assert.deepEqual(splitMarkdownBlocks(text), [text]);
      same(text);
    }
  });
});
