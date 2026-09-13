import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readStoredRun } from "./stored-run.ts";

describe("readStoredRun", () => {
  it("runner 응답을 화면 모양으로 읽는다", () => {
    const run = readStoredRun({
      status: "failed",
      startedAt: "2026-09-14T00:00:00.000Z",
      finishedAt: "2026-09-14T00:00:07.200Z",
      report: {
        totals: { total: 7, passed: 6, failed: 1 },
        failures: [{ file: "src/A.test.tsx", name: "A › b", message: "boom" }],
        files: [{ file: "src/A.test.tsx", total: 1, passed: 0, failed: 1 }],
      },
    });

    assert.equal(run?.status, "failed");
    assert.deepEqual(run?.totals, { total: 7, passed: 6, failed: 1 });
    assert.equal(run?.failures[0].name, "A › b");
    assert.deepEqual(run?.testsByFile.get("src/A.test.tsx"), { total: 1, failed: 1 });
    assert.equal(run?.durationMs, 7200);
  });

  it("리포트 없는 error 도 읽고, 모르는 모양이면 null 이다", () => {
    const run = readStoredRun({ status: "error", errorMessage: "403", report: null });
    assert.equal(run?.totals, null);
    assert.equal(run?.errorMessage, "403");
    assert.equal(run?.durationMs, null);

    assert.equal(readStoredRun(null), null);
    assert.equal(readStoredRun({ status: "weird" }), null);
  });
});
