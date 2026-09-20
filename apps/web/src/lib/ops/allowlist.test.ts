import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOpsEmail, parseOpsAllowlist } from "./allowlist.ts";

describe("parseOpsAllowlist", () => {
  it("reads a comma separated list, trimming and lowercasing", () => {
    assert.deepEqual(parseOpsAllowlist(" Me@Example.com , you@example.com "), [
      "me@example.com",
      "you@example.com",
    ]);
  });

  it("drops empty entries left by a trailing or doubled comma", () => {
    assert.deepEqual(parseOpsAllowlist("me@example.com,,"), ["me@example.com"]);
  });

  it("treats a missing or blank value as an empty list", () => {
    assert.deepEqual(parseOpsAllowlist(undefined), []);
    assert.deepEqual(parseOpsAllowlist("   "), []);
  });
});

describe("isOpsEmail", () => {
  const list = "me@example.com, teammate@example.com";

  it("lets a listed address through regardless of case", () => {
    assert.equal(isOpsEmail("me@example.com", list), true);
    assert.equal(isOpsEmail("ME@Example.com", list), true);
  });

  it("keeps everyone else out", () => {
    assert.equal(isOpsEmail("stranger@example.com", list), false);
  });

  // 설정을 빼먹었을 때 열리는 쪽으로 틀리면 안 된다. 이 화면은 가입자 목록을 담는다.
  it("lets nobody in when the list is unset or blank", () => {
    assert.equal(isOpsEmail("me@example.com", undefined), false);
    assert.equal(isOpsEmail("me@example.com", ""), false);
  });

  it("refuses a user with no email", () => {
    assert.equal(isOpsEmail(null, list), false);
    assert.equal(isOpsEmail("", list), false);
  });
});
