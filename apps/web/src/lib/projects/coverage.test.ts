import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countCoverage } from "./coverage.ts";

// 대시보드 커버리지가 파일마다 한 칸에만 들어가는지 본다. 실행: pnpm --filter @dante/web test

describe("countCoverage", () => {
  it("레포 테스트·Dante 테스트를 합쳐 세고, 상태는 마지막 실행으로 나눈다", () => {
    const sources = [
      { path: "a.ts", status: "has" as const }, // 레포 테스트, Dante 에서 안 돌림
      { path: "b.ts", status: "has" as const }, // 레포 테스트, 통과
      { path: "c.ts", status: "none" as const }, // Dante 가 만든 테스트, 실패
      { path: "d.ts", status: "none" as const }, // Dante 가 만든 테스트, 설치 실패(error)
      { path: "e.ts", status: "none" as const }, // Dante 버전은 있지만 안 돌림
      { path: "f.ts", status: "none" as const }, // 테스트 없음
    ];
    const runs = new Map<string, string | null>([
      ["b.ts", "passed"],
      ["c.ts", "failed"],
      ["d.ts", "error"],
      ["e.ts", null],
    ]);

    assert.deepEqual(countCoverage(sources, runs), {
      sources: 6,
      tested: 5,
      passed: 1,
      failed: 2,
      notRun: 2,
      untested: 1,
    });
  });

  it("돌고 있는 테스트는 결과가 없으니 미실행으로 센다", () => {
    const runs = new Map([["a.ts", "running"]]);
    assert.equal(countCoverage([{ path: "a.ts", status: "has" }], runs).notRun, 1);
  });

  it("설정·테스트 준비 파일은 분모에서 뺀다 — 추천과 같은 기준", () => {
    const coverage = countCoverage(
      [
        { path: "eslint.config.js", status: "none" },
        { path: "vitest.setup.ts", status: "none" },
        { path: "src/App.tsx", status: "none" },
      ],
      new Map()
    );
    assert.equal(coverage.sources, 1);
    assert.equal(coverage.untested, 1);
  });

  it("레포에서 사라진 파일의 Dante 기록은 세지 않는다 — 분모는 레포 트리다", () => {
    const runs = new Map([["gone.ts", "passed"]]);
    const coverage = countCoverage([{ path: "a.ts", status: "none" }], runs);
    assert.deepEqual(coverage, {
      sources: 1,
      tested: 0,
      passed: 0,
      failed: 0,
      notRun: 0,
      untested: 1,
    });
  });
});
