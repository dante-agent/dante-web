import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInviteToken,
  hashInviteToken,
  isExpired,
  isInviteToken,
  normalizeEmail,
} from "./invite-rules.ts";

// DB 없이 초대 규칙을 본다. 실행: pnpm --filter @dante/web test

describe("normalizeEmail", () => {
  it("앞뒤 공백을 떼고 소문자로 접는다", () => {
    assert.equal(normalizeEmail("  Jane.Doe@Example.COM "), "jane.doe@example.com");
  });

  it("주소 모양이 아니면 null", () => {
    for (const raw of ["", "jane", "jane@", "@example.com", "jane@example", "a b@example.com"]) {
      assert.equal(normalizeEmail(raw), null, raw);
    }
  });

  it("254자를 넘으면 null", () => {
    assert.equal(normalizeEmail(`${"a".repeat(250)}@example.com`), null);
  });
});

describe("invite token", () => {
  it("링크에 실을 모양이고, 해시는 원문에서 다시 만들 수 있다", () => {
    const { token, tokenHash } = createInviteToken();
    assert.ok(isInviteToken(token));
    assert.equal(hashInviteToken(token), tokenHash);
    assert.notEqual(token, tokenHash);
  });

  it("매번 다르다", () => {
    assert.notEqual(createInviteToken().token, createInviteToken().token);
  });

  it("모양이 틀린 값은 거른다", () => {
    for (const value of ["", "short", `${"a".repeat(42)}=`, `${"a".repeat(44)}`, "../../etc"]) {
      assert.equal(isInviteToken(value), false, value);
    }
  });
});

describe("isExpired", () => {
  it("만료 시각이 되면 죽는다", () => {
    const now = Date.now();
    assert.equal(isExpired(new Date(now + 1), now), false);
    assert.equal(isExpired(new Date(now), now), true);
  });
});
