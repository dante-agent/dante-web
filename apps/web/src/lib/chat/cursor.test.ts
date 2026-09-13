import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeCursor, encodeCursor, isUuid } from "./cursor.ts";

// 목록 커서가 왕복되고, 조작된 값은 거르는지 본다. 실행: pnpm --filter @dante/web test

const ID = "3f1c2b7a-9d4e-4c1a-8b2f-6e5d4c3b2a19";

describe("대화 목록 커서", () => {
  it("updatedAt·id 가 밀리초까지 그대로 돌아온다", () => {
    const at = new Date("2026-09-14T05:06:07.089Z");
    assert.deepEqual(decodeCursor(encodeCursor(at, ID)), { updatedAt: at, id: ID });
  });

  it("망가진 커서는 null", () => {
    assert.equal(decodeCursor("not-a-cursor"), null);
    assert.equal(decodeCursor(Buffer.from(`nope|${ID}`).toString("base64url")), null);
    // id 자리에 SQL 조각을 넣어도 uuid 검사에서 걸린다.
    const injected = Buffer.from("2026-09-14T00:00:00.000Z|' OR 1=1 --").toString("base64url");
    assert.equal(decodeCursor(injected), null);
  });

  it("isUuid 는 문자열 uuid 만 통과시킨다", () => {
    assert.equal(isUuid(ID), true);
    assert.equal(isUuid(ID.toUpperCase()), true);
    assert.equal(isUuid("123"), false);
    assert.equal(isUuid(null), false);
    assert.equal(isUuid(undefined), false);
  });
});
