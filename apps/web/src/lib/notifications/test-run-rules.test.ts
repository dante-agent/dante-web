import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TEST_RUN_STALE_MS,
  isStaleTestRun,
  parseRunInput,
  signTestRunToken,
  verifyTestRunToken,
  type RunInput,
} from "./test-run-rules.ts";

const input: RunInput = {
  pr: {
    number: 1,
    headSha: "32ac3a6",
    baseRef: "main",
    draft: false,
    labels: ["ui"],
    headCommitMessage: null,
    author: { githubId: 42, login: "octo" },
  },
  components: [{ name: "Counter", change: "changed", tests: 0, filePath: "src/Counter.tsx" }],
  failedFiles: [],
  stopped: null,
};

describe("parseRunInput", () => {
  it("JSON 으로 적었다 읽은 값을 그대로 돌려준다", () => {
    assert.deepEqual(parseRunInput(JSON.parse(JSON.stringify(input))), input);
  });

  it("작성자가 없는 PR 도 받는다", () => {
    const value = { ...input, pr: { ...input.pr, author: null } };
    assert.deepEqual(parseRunInput(value), value);
  });

  it("모양이 틀리면 null 이다", () => {
    assert.equal(parseRunInput(null), null);
    assert.equal(parseRunInput({ ...input, pr: { ...input.pr, headSha: 1 } }), null);
    assert.equal(
      parseRunInput({ ...input, components: [{ ...input.components[0], change: "moved" }] }),
      null
    );
    assert.equal(parseRunInput({ ...input, stopped: "tired" }), null);
  });
});

describe("isStaleTestRun", () => {
  const now = new Date("2026-09-17T00:30:00.000Z");

  it("상한 안이면 살아 있는 것으로 본다", () => {
    assert.equal(isStaleTestRun(new Date(now.getTime() - TEST_RUN_STALE_MS + 1), now), false);
  });

  it("상한을 넘었거나 시작 시각이 없으면 죽은 것으로 본다", () => {
    assert.equal(isStaleTestRun(new Date(now.getTime() - TEST_RUN_STALE_MS - 1), now), true);
    assert.equal(isStaleTestRun(null, now), true);
  });
});

describe("test run token", () => {
  const secret = "webhook-secret";
  const now = new Date("2026-09-17T00:00:00.000Z");
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("같은 작업이면 유효 시간 안에서 통과한다", () => {
    const token = signTestRunToken(secret, "job-1", now);
    assert.equal(verifyTestRunToken(secret, "job-1", token, later(60_000)), true);
  });

  it("다른 작업·다른 열쇠·만료·변조는 막는다", () => {
    const token = signTestRunToken(secret, "job-1", now);
    assert.equal(verifyTestRunToken(secret, "job-2", token, now), false);
    assert.equal(verifyTestRunToken("other", "job-1", token, now), false);
    assert.equal(verifyTestRunToken(secret, "job-1", token, later(6 * 60_000)), false);

    const [expiresAt, signature] = token.split(".");
    assert.equal(
      verifyTestRunToken(secret, "job-1", `${Number(expiresAt) + 60_000}.${signature}`, now),
      false
    );
    assert.equal(verifyTestRunToken(secret, "job-1", "", now), false);
    assert.equal(verifyTestRunToken(secret, "job-1", `${token}.x`, now), false);
  });
});
