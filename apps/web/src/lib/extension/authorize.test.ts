import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  MANUAL_CODE_TTL_MS,
  canonicalCode,
  createAuthCode,
  hashSecret,
  parseAuthorizeParams,
  redeemAuthCode,
  toAuthorizeParams,
  type StoredAuthCode,
} from "./authorize.ts";

// DB 없이 code 발급·교환 규칙을 본다. 실행: pnpm --filter @dante/web test

// RFC 7636 부록 B 의 예시 값.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const STATE = "state-state-state-1";

/** 꺼내면서 지우는 저장소 — Prisma delete 와 같은 성질. */
function memoryStore(now = Date.now()) {
  const rows = new Map<string, StoredAuthCode>();
  return {
    put(code: string, ttlMs: number) {
      rows.set(hashSecret(code), {
        userId: "user-1",
        codeChallenge: CHALLENGE,
        editor: "VS Code",
        expiresAt: new Date(now + ttlMs),
      });
    },
    take: async (codeHash: string) => {
      const row = rows.get(codeHash) ?? null;
      rows.delete(codeHash);
      return row;
    },
  };
}

describe("parseAuthorizeParams", () => {
  const base = { state: STATE, code_challenge: CHALLENGE, code_challenge_method: "S256" };

  it("redirect=manual 은 editor_scheme 으로 에디터 이름을 정한다", () => {
    const request = parseAuthorizeParams({ ...base, redirect: "manual", editor_scheme: "cursor" });
    assert.equal(request?.editor, "Cursor");
    assert.deepEqual(request?.delivery, { kind: "manual", scheme: "cursor" });
  });

  it("모르는 editor_scheme 이나 빠진 editor_scheme 은 거절한다", () => {
    assert.equal(
      parseAuthorizeParams({ ...base, redirect: "manual", editor_scheme: "evil" }),
      null
    );
    assert.equal(parseAuthorizeParams({ ...base, redirect: "manual" }), null);
  });

  it("에디터 redirect 는 그대로 받고, 다른 스킴은 거절한다", () => {
    const request = parseAuthorizeParams({ ...base, redirect: "vscode://dante-lib.dante/auth" });
    assert.equal(request?.delivery.kind, "redirect");
    assert.equal(parseAuthorizeParams({ ...base, redirect: "https://evil.com/auth" }), null);
  });

  it("toAuthorizeParams 로 되돌린 값은 다시 같은 요청으로 읽힌다", () => {
    for (const redirect of ["manual", "vscode://dante-lib.dante/auth"]) {
      const request = parseAuthorizeParams({ ...base, redirect, editor_scheme: "vscode" })!;
      assert.deepEqual(parseAuthorizeParams(toAuthorizeParams(request)), request);
    }
  });
});

describe("createAuthCode", () => {
  it("수동 code 는 헷갈리는 글자 없는 XXXX-XXXX-XXXX, 수명 5분이다", () => {
    const { code, ttlMs } = createAuthCode({ kind: "manual", scheme: "vscode" });
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.equal(ttlMs, MANUAL_CODE_TTL_MS);
  });

  it("에디터로 보내는 code 는 43자 base64url, 수명 60초다", () => {
    const { code, ttlMs } = createAuthCode({
      kind: "redirect",
      url: new URL("vscode://dante-lib.dante/auth"),
    });
    assert.match(code, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(ttlMs, 60_000);
  });
});

describe("canonicalCode", () => {
  it("대소문자·공백·하이픈과 O/I/L 오독을 받아준다", () => {
    assert.equal(canonicalCode(" abcd efgh-oil0 "), "ABCD-EFGH-0110");
    assert.equal(canonicalCode("ABCDEFGH0110"), "ABCD-EFGH-0110");
  });

  it("에디터로 보내는 code 는 건드리지 않는다", () => {
    const code = createHash("sha256").update("x").digest("base64url");
    assert.equal(canonicalCode(code), code);
  });
});

describe("redeemAuthCode", () => {
  it("맞는 code + verifier 면 행을 돌려준다 (옮겨 적은 모양이 달라도)", async () => {
    const store = memoryStore();
    store.put("ABCD-EFGH-JKMN", MANUAL_CODE_TTL_MS);
    const row = await redeemAuthCode("abcd efgh jkmn", VERIFIER, store.take);
    assert.equal(row?.userId, "user-1");
  });

  it("만료된 code 는 거절한다", async () => {
    const store = memoryStore();
    store.put("ABCD-EFGH-JKMN", MANUAL_CODE_TTL_MS);
    const later = Date.now() + MANUAL_CODE_TTL_MS + 1;
    assert.equal(await redeemAuthCode("ABCD-EFGH-JKMN", VERIFIER, store.take, later), null);
  });

  it("한 번 쓴 code 는 다시 못 쓴다", async () => {
    const store = memoryStore();
    store.put("ABCD-EFGH-JKMN", MANUAL_CODE_TTL_MS);
    assert.ok(await redeemAuthCode("ABCD-EFGH-JKMN", VERIFIER, store.take));
    assert.equal(await redeemAuthCode("ABCD-EFGH-JKMN", VERIFIER, store.take), null);
  });

  it("verifier 가 틀리면 거절하고, 그 시도로 code 도 사라진다", async () => {
    const store = memoryStore();
    store.put("ABCD-EFGH-JKMN", MANUAL_CODE_TTL_MS);
    const wrong = "x".repeat(43);
    assert.equal(await redeemAuthCode("ABCD-EFGH-JKMN", wrong, store.take), null);
    assert.equal(await redeemAuthCode("ABCD-EFGH-JKMN", VERIFIER, store.take), null);
  });

  it("모양이 잘못된 verifier 는 저장소를 건드리지 않고 거절한다", async () => {
    const store = memoryStore();
    store.put("ABCD-EFGH-JKMN", MANUAL_CODE_TTL_MS);
    assert.equal(await redeemAuthCode("ABCD-EFGH-JKMN", "short", store.take), null);
    assert.ok(await redeemAuthCode("ABCD-EFGH-JKMN", VERIFIER, store.take));
  });
});
