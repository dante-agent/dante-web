import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStoredRunLog } from "./stored-run-log.ts";

// 저장된 실행 로그 → 터미널 단계. 실행: pnpm --filter @dante/web test

const ESC = String.fromCharCode(27);

describe("parseStoredRunLog", () => {
  it("명령마다 단계를 가리고 색 코드는 그대로 둔다", () => {
    const logs = [
      "$ npm ci",
      "added 135 packages",
      "(exit 0)",
      "",
      "$ mkdir -p /tmp/dante-toolkit && cd /tmp/dante-toolkit && npm install x",
      "added 3 packages",
      "(exit 0)",
      "",
      "$ npm run test -- 'a.test.tsx' --reporter=json --outputFile.json=/tmp/dante-report.json",
      `${ESC}[32m✓${ESC}[39m a.test.tsx (5 tests)`,
      "",
      "(exit 1)",
    ].join("\n");

    assert.deepEqual(parseStoredRunLog(logs), [
      { step: "install", exitCode: 0, text: "added 135 packages" },
      { step: "toolkit", exitCode: 0, text: "added 3 packages" },
      { step: "test", exitCode: 1, text: `${ESC}[32m✓${ESC}[39m a.test.tsx (5 tests)` },
    ]);
  });

  it("앞이 잘린 로그는 첫 조각을 설치 출력으로 본다", () => {
    const logs =
      "…packages\n(exit 0)\n\n$ vitest --outputFile=/tmp/dante-report.json\nok\n(exit 0)";
    assert.deepEqual(parseStoredRunLog(logs), [
      { step: "install", exitCode: 0, text: "…packages" },
      { step: "test", exitCode: 0, text: "ok" },
    ]);
  });

  it("시간 초과로 종료 코드가 없으면 null", () => {
    assert.deepEqual(parseStoredRunLog("$ npm ci\nslow\n(exit null)"), [
      { step: "install", exitCode: null, text: "slow" },
    ]);
  });
});
