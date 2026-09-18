import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMENT_MARKER, renderPrComment } from "./comment.ts";
import { SAMPLE_RUNS, type RunSummary } from "./run-summary.ts";
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from "./settings.ts";

const failing = SAMPLE_RUNS.failing;
const passing = SAMPLE_RUNS.passing;
const en = DEFAULT_NOTIFICATION_SETTINGS;
const ko: NotificationSettings = { ...en, prCommentLocale: "ko" };

const moreFailures: RunSummary = {
  ...failing,
  failures: [
    ...failing.failures,
    { file: "Badge.test.tsx", name: "renders", message: null },
    { file: "Badge.test.tsx", name: "hides when empty", message: null },
  ],
};

describe("renderPrComment", () => {
  it("starts with the marker so the sticky comment can be found again", () => {
    assert.ok(renderPrComment(failing, en).startsWith(`${COMMENT_MARKER}\n`));
  });

  it("writes a failing run with the failure list and a collapsed component table", () => {
    const body = renderPrComment(failing, en);
    assert.match(body, /^### Dante — 3 of 24 tests failed$/m);
    assert.match(body, /^\| Tests \| 24 total · \*\*21 passed\*\* · \*\*3 failed\*\* \|$/m);
    assert.match(body, /^\| Components \| 2 added · 1 changed \|$/m);
    assert.match(
      body,
      /^- `Button\.test\.tsx` › renders disabled state — `expected "true" to be "false"`$/m
    );
    assert.match(body, /<details><summary>Components in this PR<\/summary>/);
    assert.match(
      body,
      /\[Open in Dante\]\(https:\/\/dante\.dev\/project\/sample\/pull\/42\) · \[Re-run\]/
    );
  });

  it("collapses a passing run into one line, with the component table nested inside", () => {
    const body = renderPrComment(passing, en);
    assert.match(
      body,
      /<details><summary>Dante — 24 passed · 3 components updated · 12s<\/summary>/
    );
    assert.equal(body.match(/<details>/g)?.length, 2);
    assert.equal(body.match(/<\/details>/g)?.length, 2);
    assert.doesNotMatch(body, /^### /m);
  });

  it("keeps the title line when collapsing is off", () => {
    const body = renderPrComment(passing, { ...en, prCommentCollapseOnPass: false });
    assert.match(body, /^### Dante — all 24 tests passed$/m);
  });

  it("cuts the failure list at the limit", () => {
    assert.match(
      renderPrComment(moreFailures, { ...en, prCommentFailedLimit: 2 }),
      /^- …and 3 more$/m
    );
    assert.match(renderPrComment(moreFailures, { ...ko, prCommentFailedLimit: 2 }), /^- …외 3개$/m);
  });

  describe("in Korean", () => {
    it("translates our words", () => {
      const body = renderPrComment(failing, ko);
      assert.match(body, /^### Dante — 테스트 24개 중 3개 실패$/m);
      assert.match(body, /^\| 테스트 \| 전체 24개 · \*\*21개 통과\*\* · \*\*3개 실패\*\* \|$/m);
      assert.match(body, /^\| 컴포넌트 \| 추가 2개 · 변경 1개 \|$/m);
      assert.match(body, /^\*\*실패\*\*$/m);
      assert.match(body, /<details><summary>이 PR 의 컴포넌트<\/summary>/);
      assert.match(body, /^\| `Card` \| 추가 \| 11 \|$/m);
      assert.match(body, /\[Dante 에서 보기\]\(.+\) · \[다시 실행\]\(.+\)/);
    });

    it("leaves test names, paths and failure messages as they are", () => {
      const body = renderPrComment(failing, ko);
      assert.match(
        body,
        /^- `Button\.test\.tsx` › renders disabled state — `expected "true" to be "false"`$/m
      );
    });

    it("leaves Dante's own reasons as they are", () => {
      const skipped: RunSummary = {
        ...failing,
        status: "skipped",
        skipReason: "This project has no test runner picked in Dante, so it did not run tests.",
      };
      const body = renderPrComment(skipped, ko);
      assert.match(body, /^### Dante — 테스트 생성을 건너뛰었습니다$/m);
      assert.match(body, /^> This project has no test runner picked in Dante/m);
    });

    it("collapses a passing run into a Korean line", () => {
      assert.match(
        renderPrComment(passing, ko),
        /<details><summary>Dante — 24개 통과 · 컴포넌트 3개 갱신 · 12s<\/summary>/
      );
    });
  });

  it("escapes markdown in test names so they cannot turn into formatting", () => {
    const run: RunSummary = {
      ...failing,
      failures: [{ file: "a.test.tsx", name: "renders *bold* `code` | pipe", message: null }],
    };
    assert.match(
      renderPrComment(run, en),
      /^- `a\.test\.tsx` › renders \\\*bold\\\* \\`code\\` \\\| pipe$/m
    );
  });
});
