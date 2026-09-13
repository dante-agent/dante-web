import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { costUsd, maxCostUsd } from "./pricing.ts";

// 호출 전 예약 금액(원가 상한). 실행: pnpm --filter @dante/web test

const MODEL = "gpt-5.3-codex";

describe("maxCostUsd", () => {
  it("같은 토큰 수의 실제 원가보다 작지 않다", () => {
    const prompt = "a".repeat(10_000);
    const upper = maxCostUsd(MODEL, { prompt, maxOutputTokens: 1_000 });
    // 1바이트 문자라 입력 토큰은 최대 10_000 이다. 출력을 상한까지 다 써도 넘지 않아야 한다.
    const actual = costUsd(MODEL, {
      inputTokens: 10_000,
      cachedInputTokens: 0,
      outputTokens: 1_000,
    });
    assert.ok(actual !== null && upper >= actual);
  });

  it("한국어는 글자 수가 아니라 UTF-8 바이트 수로 센다", () => {
    const ascii = maxCostUsd(MODEL, { prompt: "a".repeat(3_000), maxOutputTokens: 0 });
    const korean = maxCostUsd(MODEL, { prompt: "가".repeat(1_000), maxOutputTokens: 0 });
    assert.equal(korean, ascii);
  });

  it("출력 상한이 금액을 정한다", () => {
    const small = maxCostUsd(MODEL, { prompt: "", maxOutputTokens: 1_000 });
    const large = maxCostUsd(MODEL, { prompt: "", maxOutputTokens: 16_000 });
    // 출력 15_000 토큰 × $14/M = $0.21
    assert.equal(Number((large - small).toFixed(6)), 0.21);
  });

  it("단가를 모르는 모델이면 던진다", () => {
    assert.throws(() => maxCostUsd("unknown-model", { prompt: "", maxOutputTokens: 1 }));
  });
});
