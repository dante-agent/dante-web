import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRunResult, skippedCheckRun, timedOutCheckRun } from "./check-run.ts";
import { SAMPLE_RUNS, type RunSummary } from "./run-summary.ts";
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from "./settings.ts";

const failing = SAMPLE_RUNS.failing;
const passing = SAMPLE_RUNS.passing;
const en = DEFAULT_NOTIFICATION_SETTINGS;
const ko: NotificationSettings = { ...en, prCommentLocale: "ko" };

describe("checkRunResult", () => {
  it("reports a passing run as success", () => {
    assert.deepEqual(checkRunResult(passing, en), {
      status: "completed",
      conclusion: "success",
      title: "24 passed",
      summary: "All 24 tests passed.",
    });
  });

  it("blocks the merge on failure only when blocking is on", () => {
    assert.equal(checkRunResult(failing, en).conclusion, "neutral");
    assert.equal(checkRunResult(failing, { ...en, checkRunBlocking: true }).conclusion, "failure");
  });

  it("lists a few failures and points at the rest", () => {
    const run: RunSummary = {
      ...failing,
      totals: { total: 30, passed: 23, failed: 7 },
      failures: Array.from({ length: 7 }, (_, index) => ({
        file: "a.test.tsx",
        name: `case ${index + 1}`,
        message: null,
      })),
    };
    const { summary } = checkRunResult(run, en);
    assert.match(summary, /^7 of 30 tests failed\.$/m);
    assert.match(summary, /^- a\.test\.tsx › case 5$/m);
    assert.doesNotMatch(summary, /case 6/);
    assert.match(summary, /^- …and 2 more$/m);
  });

  describe("in Korean", () => {
    it("translates the title and summary", () => {
      assert.equal(checkRunResult(passing, ko).title, "24개 통과");
      assert.equal(checkRunResult(passing, ko).summary, "테스트 24개 모두 통과했습니다.");

      const failed = checkRunResult(failing, ko);
      assert.equal(failed.title, "3개 실패");
      assert.match(failed.summary, /^테스트 24개 중 3개가 실패했습니다\.$/m);
      assert.match(failed.summary, /^- Button\.test\.tsx › renders disabled state$/m);
    });

    it("leaves Dante's own error as it is", () => {
      const run: RunSummary = { ...failing, status: "failed", error: "Install failed: exit 1" };
      assert.deepEqual(checkRunResult(run, ko), {
        status: "completed",
        conclusion: "neutral",
        title: "실행을 끝내지 못함",
        summary: "Install failed: exit 1",
      });
    });
  });
});

describe("skippedCheckRun", () => {
  it("translates only the title and keeps the reason", () => {
    assert.deepEqual(skippedCheckRun("Draft pull request", "ko"), {
      status: "completed",
      conclusion: "skipped",
      title: "건너뜀",
      summary: "Draft pull request",
    });
  });
});

describe("timedOutCheckRun", () => {
  it("is cancelled, not failed, so it reads as retryable", () => {
    assert.equal(timedOutCheckRun("en").conclusion, "cancelled");
    assert.equal(timedOutCheckRun("ko").title, "시간 초과");
  });
});
