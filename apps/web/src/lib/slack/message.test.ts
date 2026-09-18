import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_RUNS } from "../notifications/run-summary.ts";
import { renderSlackMessage } from "./message.ts";

const repo = { owner: "wlrnjs", name: "my-blog" };

describe("renderSlackMessage", () => {
  it("puts the repo and PR in the first lines and lists failures", () => {
    const text = renderSlackMessage({
      event: "failed",
      run: SAMPLE_RUNS.failing,
      repo,
      prNumber: 42,
      failedLimit: 2,
    });
    const lines = text.split("\n");

    assert.equal(lines[0], "*dante* · 3 of 24 tests failed");
    assert.equal(lines[1], "<https://github.com/wlrnjs/my-blog/pull/42|wlrnjs/my-blog #42>");
    assert.ok(text.includes("• `Button.test.tsx` › renders disabled state"));
    assert.ok(text.includes("…and 1 more"));
    assert.ok(text.includes("|Open the pull request>"));
  });

  it("escapes angle brackets so test names cannot become links", () => {
    const run = {
      ...SAMPLE_RUNS.failing,
      failures: [{ file: "A.test.tsx", name: "renders <Button>", message: "a & b" }],
    };
    const text = renderSlackMessage({ event: "failed", run, repo, prNumber: 1, failedLimit: 10 });

    assert.ok(text.includes("renders &lt;Button&gt; — a &amp; b"));
  });

  it("links the repo, not a made-up PR, for a test message", () => {
    const text = renderSlackMessage({
      event: "failed",
      run: { ...SAMPLE_RUNS.failing, detailUrl: null },
      repo,
      prNumber: null,
      failedLimit: 10,
      test: true,
    });

    assert.ok(text.startsWith("_Test notification from Dante"));
    assert.ok(text.includes("<https://github.com/wlrnjs/my-blog|wlrnjs/my-blog>"));
    assert.ok(!text.includes("/pull/"));
    assert.ok(!text.includes("Open the pull request"));
  });

  it("does not list failures when announcing a recovery", () => {
    const text = renderSlackMessage({
      event: "recovered",
      run: SAMPLE_RUNS.passing,
      repo,
      prNumber: 42,
      failedLimit: 10,
    });

    assert.ok(text.startsWith("*dante* · Fixed — all 24 tests pass now"));
    assert.ok(!text.includes("•"));
  });
});
