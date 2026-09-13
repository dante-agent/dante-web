import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_PATH, buildTestCommand, parseReport } from "./report.ts";

// 러너 JSON 리포트 해석 규칙. 실행: pnpm --filter @dante/runner test

const REPO = "/vercel/my-blog";

describe("buildTestCommand", () => {
  it("vitest 는 기본 출력과 json 리포트를 같이 켠다", () => {
    assert.equal(
      buildTestCommand("pnpm vitest run", "vitest", ["src/A.test.tsx"]),
      `pnpm vitest run 'src/A.test.tsx' --reporter=default --reporter=json --outputFile.json=${REPORT_PATH}`
    );
  });

  it("jest 는 --json 을 쓰고, 경로의 따옴표를 이스케이프한다", () => {
    assert.equal(
      buildTestCommand("npx jest", "jest", ["src/it's.test.tsx"]),
      `npx jest 'src/it'\\''s.test.tsx' --json --outputFile=${REPORT_PATH}`
    );
  });
});

describe("parseReport", () => {
  it("통과·실패를 세고 실패 이름과 메시지 첫 줄을 남긴다", () => {
    const raw = JSON.stringify({
      testResults: [
        {
          name: `${REPO}/src/Sidebar.test.tsx`,
          status: "failed",
          assertionResults: [
            { fullName: "Sidebar renders", status: "passed", failureMessages: [] },
            {
              fullName: "Sidebar › lists tags",
              status: "failed",
              failureMessages: ["[31mAssertionError: expected 1 to be 2[39m\n    at foo.ts:1"],
            },
            { fullName: "Sidebar skipped", status: "skipped", failureMessages: [] },
          ],
        },
      ],
    });

    assert.deepEqual(parseReport(raw, REPO), {
      totals: { total: 2, passed: 1, failed: 1 },
      failures: [
        {
          file: "src/Sidebar.test.tsx",
          name: "Sidebar › lists tags",
          message: "AssertionError: expected 1 to be 2",
        },
      ],
      files: [{ file: "src/Sidebar.test.tsx", total: 2, passed: 1, failed: 1 }],
    });
  });

  it("파일 자체가 깨져 테스트가 안 돈 경우도 실패로 센다", () => {
    const raw = JSON.stringify({
      testResults: [
        {
          name: `${REPO}/src/Broken.test.tsx`,
          status: "failed",
          message: "Error: Cannot find module './Broken'",
          assertionResults: [],
        },
      ],
    });

    assert.deepEqual(parseReport(raw, REPO)?.totals, { total: 1, passed: 0, failed: 1 });
    assert.equal(
      parseReport(raw, REPO)?.failures[0].message,
      "Error: Cannot find module './Broken'"
    );
  });

  it("리포트가 아니면 null 이다 (0 개 통과로 접지 않는다)", () => {
    assert.equal(parseReport("", REPO), null);
    assert.equal(parseReport("{}", REPO), null);
  });
});
