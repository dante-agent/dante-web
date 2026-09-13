import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorSkipReason } from "./pr-author-rules.ts";

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
