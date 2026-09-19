import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeStats } from "./code-analysis.ts";
import { scoreFile } from "./recommendation-score.ts";

// 실행: pnpm --filter @dante/web test

const code = (over: Partial<CodeStats & { fanIn: number }>) => ({
  lines: 50,
  branches: 2,
  hasLogic: true,
  barrel: false,
  fanIn: 0,
  ...over,
});

describe("scoreFile", () => {
  it("분기가 많고 많이 쓰이는 파일이 높음", () => {
    const r = scoreFile("src/lib/pricing.ts", {
      code: code({ lines: 300, branches: 40, fanIn: 12 }),
    });
    assert.equal(r.priority, "high");
    assert.equal(r.reason, "40 branches, used by 12 files, 300 lines");
  });

  it("분기가 적고 아무도 안 쓰면 낮음", () => {
    const r = scoreFile("src/lib/format.ts", { code: code({ lines: 10, branches: 0 }) });
    assert.equal(r.priority, "low");
  });

  it("같은 조건이면 도메인 위험 파일이 앞선다", () => {
    const c = code({ lines: 100, branches: 10, fanIn: 3 });
    const auth = scoreFile("src/auth/verify.ts", { code: c });
    const plain = scoreFile("src/misc/verify.ts", { code: c });
    assert.ok(auth.score > plain.score);
    assert.match(auth.reason, /auth logic/i);
  });

  it("도메인 단어는 단어 단위로만 맞춘다", () => {
    const c = code({});
    assert.doesNotMatch(scoreFile("src/border.ts", { code: c }).reason, /logic/);
    assert.doesNotMatch(scoreFile("src/author/list.ts", { code: c }).reason, /logic/);
    assert.match(scoreFile("src/useSignIn.ts", { code: c }).reason, /signin logic/i);
    assert.match(scoreFile("src/orders/list.ts", { code: c }).reason, /orders logic/i);
  });

  it("타입·상수만 있으면 크게 깎는다", () => {
    const r = scoreFile("src/auth/types.ts", {
      code: code({ hasLogic: false, fanIn: 20, branches: 0 }),
    });
    assert.equal(r.priority, "low");
    assert.equal(r.reason, "No logic to test (types or constants only)");
  });

  it("배럴은 크게 깎는다", () => {
    const r = scoreFile("src/index.ts", { code: code({ barrel: true, fanIn: 20 }) });
    assert.equal(r.priority, "low");
  });

  it("단순 UI 는 깎는다", () => {
    const c = code({ lines: 120, branches: 10, fanIn: 4 });
    const ui = scoreFile("src/components/ui/button.tsx", { code: c });
    const feature = scoreFile("src/components/cart/button.tsx", { code: c });
    assert.ok(ui.score < feature.score);
    assert.equal(ui.reason, "Simple UI component");
  });

  it("코드를 못 읽으면 경로·크기만으로 매긴다", () => {
    const big = scoreFile("src/lib/engine.ts", { size: 12_000 });
    const small = scoreFile("src/lib/engine.ts", { size: 300 });
    assert.ok(big.score > small.score);
    assert.equal(scoreFile("src/auth/login.ts", { size: 3_000 }).priority, "high");
  });

  it("코드를 못 읽고 도메인 신호도 없으면 경로 기반임을 사유로 밝힌다", () => {
    assert.match(scoreFile("src/lib/engine.ts", { size: 3_000 }).reason, /path only/i);
  });

  it("한글로 이름 지은 도메인도 위험으로 잡는다", () => {
    const c = code({ lines: 100, branches: 10, fanIn: 3 });
    const ko = scoreFile("src/결제.ts", { code: c });
    const plain = scoreFile("src/기타.ts", { code: c });
    assert.ok(ko.score > plain.score);
    assert.match(ko.reason, /결제/);
  });

  it("구조상 깎인 파일만 deprioritized 로 표시한다", () => {
    assert.equal(scoreFile("src/index.ts", { code: code({ barrel: true }) }).deprioritized, true);
    assert.equal(scoreFile("src/components/ui/button.tsx", { code: code({}) }).deprioritized, true);
    assert.equal(
      scoreFile("src/lib/pricing.ts", { code: code({ branches: 40, fanIn: 12, lines: 300 }) })
        .deprioritized,
      false
    );
  });
});
