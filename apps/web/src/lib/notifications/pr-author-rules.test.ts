import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorSkipReason, payerOutcome } from "./pr-author-rules.ts";

// PR 작성자 판정 → 건너뜀 사유. 실행: pnpm --filter @dante/web test

describe("authorSkipReason", () => {
  it("작성자 한도로 셀 수 있으면 건너뛰지 않는다", () => {
    assert.equal(authorSkipReason({ kind: "ok", userId: "user-1" }), null);
  });

  it("건너뛰는 경우마다 이유를 적는다", () => {
    const kinds = [
      { kind: "unknown" },
      { kind: "not-member", login: "octocat" },
      { kind: "budget-exceeded", login: "octocat" },
      { kind: "budget-unavailable", login: "octocat" },
    ] as const;

    for (const check of kinds) {
      const reason = authorSkipReason(check);
      assert.ok(reason && reason.includes("skipped test generation"), check.kind);
    }
  });

  it("로그인에 @ 를 붙이지 않는다 (코멘트가 멘션 알림을 보내지 않게)", () => {
    const reason = authorSkipReason({ kind: "not-member", login: "octocat" });
    assert.ok(reason?.includes("(octocat)"));
    assert.ok(!reason?.includes("@octocat"));
  });
});

describe("payerOutcome", () => {
  const requesters = [
    { kind: "github-requester", account: { githubId: 1, login: "octocat" } },
    { kind: "dante-requester", userId: "user-1", login: "octocat" },
  ] as const;

  it("작성자가 비용을 낼 수 없으면 실패가 아니라 건너뛴다 (외부 기여자 PR 의 머지를 막지 않게)", () => {
    const outcome = payerOutcome({ kind: "not-member", login: "octocat" }, { kind: "author" });
    assert.equal(outcome.status, "skipped");
  });

  it("Re-run 요청자가 팀 멤버가 아니거나 알 수 없으면 실패로 끝낸다", () => {
    for (const payer of requesters) {
      const notMember = payerOutcome({ kind: "not-member", login: "octocat" }, payer);
      assert.equal(notMember.status, "failed", payer.kind);
      assert.ok(notMember.status === "failed" && notMember.error.includes("octocat"));
      assert.equal(payerOutcome({ kind: "unknown" }, payer).status, "failed", payer.kind);
    }
  });

  it("Re-run 요청자의 한도 문제는 건너뛰고 요청자를 사유에 적는다", () => {
    for (const payer of requesters) {
      for (const kind of ["budget-exceeded", "budget-unavailable"] as const) {
        const outcome = payerOutcome({ kind, login: "octocat" }, payer);
        assert.equal(outcome.status, "skipped", `${payer.kind} ${kind}`);
        assert.ok(
          outcome.status === "skipped" && outcome.skipReason.includes("requested this re-run")
        );
        assert.ok(!outcome.skipReason.includes("@octocat"));
      }
    }
  });
});
