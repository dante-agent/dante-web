import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalRun, type GenerationOutcome, type RunnerOutcome } from "./run-result.ts";
import { queuedRun } from "./run-summary.ts";

const base = queuedRun({ detailUrl: null, rerunUrl: null });
const components = [
  { name: "Counter", change: "changed" as const, tests: 0, filePath: "src/Counter.tsx" },
  { name: "Badge", change: "added" as const, tests: 0, filePath: "src/Badge.tsx" },
];
const generation: GenerationOutcome = {
  tests: [
    { filePath: "src/Counter.tsx", testPath: "src/Counter.test.tsx" },
    { filePath: "src/Badge.tsx", testPath: "src/Badge.test.tsx" },
  ],
  failedFiles: [],
  stopped: null,
};
const times = { startedAt: "2026-09-14T00:00:00.000Z", finishedAt: "2026-09-14T00:00:12.500Z" };

describe("finalRun", () => {
  it("리포트를 합계·실패·컴포넌트별 테스트 수로 옮긴다", () => {
    const result: RunnerOutcome = {
      status: "failed",
      ...times,
      report: {
        totals: { total: 7, passed: 6, failed: 1 },
        failures: [{ file: "src/Badge.test.tsx", name: "Badge › caps", message: "boom" }],
        files: [
          { file: "src/Counter.test.tsx", total: 4 },
          { file: "src/Badge.test.tsx", total: 3 },
        ],
      },
    };

    const run = finalRun(base, { components, generation, testRun: { kind: "ran", result } });

    assert.equal(run.status, "completed");
    assert.deepEqual(run.totals, { total: 7, passed: 6, failed: 1 });
    assert.equal(run.failures.length, 1);
    assert.deepEqual(run.components, [
      { name: "Counter", change: "changed", tests: 4 },
      { name: "Badge", change: "added", tests: 3 },
    ]);
    assert.equal(run.durationMs, 12_500);
  });

  it("runner 가 못 돌렸으면 테스트 실패가 아니라 failed 다", () => {
    const result: RunnerOutcome = {
      status: "error",
      errorMessage: "Install failed (exit 1)",
      report: null,
      ...times,
    };
    const run = finalRun(base, { components, generation, testRun: { kind: "ran", result } });

    assert.equal(run.status, "failed");
    assert.equal(run.error, "Install failed (exit 1)");
    assert.deepEqual(run.totals, { total: 0, passed: 0, failed: 0 });
  });

  it("리포트가 없으면 passed 여도 failed 로 둔다", () => {
    const result: RunnerOutcome = { status: "passed", report: null, ...times };
    assert.equal(
      finalRun(base, { components, generation, testRun: { kind: "ran", result } }).status,
      "failed"
    );
  });

  it("러너를 안 골랐거나 runner 가 없으면 skipped 로 이유를 적는다", () => {
    for (const reason of ["no-framework", "runner-not-configured"] as const) {
      const run = finalRun(base, { components, generation, testRun: { kind: "not-run", reason } });
      assert.equal(run.status, "skipped");
      assert.ok(run.skipReason);
    }
  });

  it("만든 테스트가 없으면 한도로 멈춘 경우만 skipped, 아니면 failed", () => {
    const empty = { tests: [], failedFiles: ["src/Counter.tsx"], stopped: null };
    const noTests = { kind: "not-run", reason: "no-tests" } as const;

    assert.equal(
      finalRun(base, { components, generation: empty, testRun: noTests }).status,
      "failed"
    );
    assert.equal(
      finalRun(base, {
        components,
        generation: { ...empty, stopped: "budget-exceeded" },
        testRun: noTests,
      }).status,
      "skipped"
    );
  });
});
