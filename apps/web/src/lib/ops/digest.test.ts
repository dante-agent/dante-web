import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderOpsDigest } from "./digest.ts";
import type { OpsMetrics } from "./metrics.ts";

const BASE: OpsMetrics = {
  signups: { total: 12, last24h: 3, last7d: 9 },
  projects: { total: 5, last24h: 1, last7d: 4 },
  testRuns: { total: 41, last24h: 15, last7d: 33 },
  runStatuses: [
    { status: "passed", count: 30 },
    { status: "failed", count: 11 },
  ],
  ai: { periodLabel: "September 2026", costUsd: 3.21, calls: 128, unknownCostCalls: 0 },
  demoBudget: null,
  recentSignups: [],
};

// budget.ts 의 BudgetStatus 를 그대로 쓰면 BillingPeriod 까지 채워야 해서, 요약이
// 읽는 칸만 만들어 쓴다. 읽지 않는 칸이 늘어도 이 테스트는 흔들리지 않는다.
function withDemo(usedUsd: number, limitUsd: number, exceeded = false): OpsMetrics {
  return {
    ...BASE,
    demoBudget: {
      email: "demo@example.com",
      usedUsd,
      limitUsd,
      exceeded,
      planName: null,
      knownUsd: usedUsd,
      unknownCalls: 0,
      period: {
        start: new Date("2026-09-01T00:00:00Z"),
        end: new Date("2026-10-01T00:00:00Z"),
        label: "September 2026",
        resetsLabel: "October 1, 2026",
        resetsDayLabel: "Oct 1",
      },
    },
  };
}

describe("renderOpsDigest", () => {
  it("leads with the counts and today's change", () => {
    const content = renderOpsDigest(BASE, null);
    assert.match(content, /가입 \*\*12명\*\* \(오늘 \+3\)/);
    assert.match(content, /테스트 실행 \*\*41건\*\* \(오늘 \+15\)/);
    assert.match(content, /AI 지출 \*\*\$3\.21\*\* · September 2026/);
  });

  it("links to the ops page when we know the address", () => {
    assert.match(renderOpsDigest(BASE, "https://dante.dev/ops"), /\[지표 화면 열기\]\(<https:/);
    assert.doesNotMatch(renderOpsDigest(BASE, null), /지표 화면 열기/);
  });

  // 실행이 떨어진 것(failed)과 실행 자체가 안 된 것(error)은 볼 사람이 다르다.
  it("calls out runs that could not finish, and stays quiet when there are none", () => {
    assert.doesNotMatch(renderOpsDigest(BASE, null), /끝내지 못한/);
    const withErrors = { ...BASE, runStatuses: [{ status: "error", count: 2 }] };
    assert.match(renderOpsDigest(withErrors, null), /실행을 끝내지 못한 건 2건/);
  });

  describe("demo budget", () => {
    it("is left out when there is no demo account", () => {
      assert.doesNotMatch(renderOpsDigest(BASE, null), /데모 계정 예산/);
    });

    it("reports the share used", () => {
      assert.match(renderOpsDigest(withDemo(1, 5), null), /\$1\.00 \/ \$5\.00\*\* \(20%\)/);
    });

    it("warns before it runs out", () => {
      assert.match(renderOpsDigest(withDemo(4, 5), null), /곧 소진됩니다/);
      assert.doesNotMatch(renderOpsDigest(withDemo(3, 5), null), /곧 소진됩니다/);
    });

    it("says plainly that AI is blocked once the limit is gone", () => {
      assert.match(renderOpsDigest(withDemo(5.4, 5, true), null), /다 썼습니다.+AI 가 막혀/);
    });

    // 한도 0 은 "AI 끄기"다(.env.example). 0 으로 나눠 NaN% 를 보내면 안 된다.
    it("says the budget is off instead of dividing by zero", () => {
      const content = renderOpsDigest(withDemo(0, 0), null);
      assert.match(content, /데모 계정 예산 \*\*꺼짐\*\*/);
      assert.doesNotMatch(content, /NaN/);
    });
  });

  it("truncates rather than letting Discord reject the whole message", () => {
    const long = { ...BASE, ai: { ...BASE.ai, periodLabel: "x".repeat(3000) } };
    const content = renderOpsDigest(long, null);
    assert.equal(content.length, 2000);
    assert.ok(content.endsWith("…"));
  });
});
