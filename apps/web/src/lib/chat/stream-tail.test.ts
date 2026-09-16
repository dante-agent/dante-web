import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeTail, NO_ACTIONS, splitStream } from "./stream-tail.ts";

// 채팅 답 꼬리가 왕복되고, 스트리밍 중·깨진 꼬리를 안전하게 다루는지 본다. 실행: pnpm --filter @dante/web test

describe("채팅 답 꼬리", () => {
  it("답·토큰·저장 여부·실행 요청이 그대로 돌아온다", () => {
    const tail = {
      contextTokens: 1234,
      saved: true,
      actions: { edited: true, runVersionId: "3f1c2b7a-9d4e-4c1a-8b2f-6e5d4c3b2a19" },
    };
    assert.deepEqual(splitStream("답입니다" + encodeTail(tail)), { answer: "답입니다", tail });
  });

  it("저장 실패와 토큰 수 없음을 구분해서 돌려준다", () => {
    const { tail } = splitStream(
      "a" + encodeTail({ contextTokens: null, saved: false, actions: NO_ACTIONS })
    );
    assert.deepEqual(tail, { contextTokens: null, saved: false, actions: NO_ACTIONS });
  });

  it("꼬리가 아직 안 왔으면 답만 돌려준다", () => {
    assert.deepEqual(splitStream("스트리밍 중"), { answer: "스트리밍 중", tail: null });
    // 토큰 수까지만 온 조각도 아직 꼬리가 아니다.
    assert.deepEqual(splitStream("a\u001e12"), { answer: "a", tail: null });
  });

  it("actions 가 깨졌거나 모양이 다르면 아무 일도 하지 않는다", () => {
    assert.deepEqual(splitStream("a\u001e1\u001e\u001e{broken").tail?.actions, NO_ACTIONS);
    assert.deepEqual(
      splitStream('a\u001e1\u001e\u001e{"edited":"yes","runVersionId":42}').tail?.actions,
      NO_ACTIONS
    );
  });
});
