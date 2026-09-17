import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pullRequestResult } from "./pull-request-result.ts";

// 대시보드 PR 줄의 상태 접기를 본다. 실행: pnpm --filter @dante/web test

const job = (status: string, runResult: unknown = null, error: string | null = null) => ({
  status,
  runResult,
  error,
});

describe("pullRequestResult", () => {
  it("진행 중인 단계는 생성·실행 둘로 나눈다", () => {
    assert.equal(pullRequestResult(job("queued")).note, "Generating tests");
    assert.equal(pullRequestResult(job("running")).note, "Generating tests");
    assert.equal(pullRequestResult(job("awaiting_run")).note, "Running tests");
    assert.deepEqual(pullRequestResult(job("testing")), {
      tone: "running",
      label: "Running",
      note: "Running tests",
    });
  });

  it("끝난 실행은 리포트 개수로 말한다", () => {
    const passed = { status: "passed", report: { totals: { total: 3, passed: 3, failed: 0 } } };
    const failed = { status: "failed", report: { totals: { total: 4, passed: 3, failed: 1 } } };
    assert.deepEqual(pullRequestResult(job("done", passed)), {
      tone: "passed",
      label: "Passed",
      note: "3 of 3 tests passed",
    });
    assert.deepEqual(pullRequestResult(job("done", failed)), {
      tone: "failed",
      label: "Failed",
      note: "1 of 4 tests failed",
    });
  });

  it("작업 실패는 에러 첫 줄, 돌린 게 없으면 통과가 아니라 건너뜀", () => {
    assert.deepEqual(pullRequestResult(job("failed", null, "Timed out\nstack...")), {
      tone: "error",
      label: "Error",
      note: "Timed out",
    });
    assert.equal(pullRequestResult(job("done")).tone, "skipped");
  });
});
