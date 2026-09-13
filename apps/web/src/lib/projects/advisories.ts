// 대시보드 Advisor 섹션의 판정 (서버 전용 입력을 받는 순수 함수).
//
//   - reliability: 최근 실패/에러한 테스트 (TestRun; 러너 없으면 빈 목록 → 카드 없음)
//   - coverage:    테스트 파일이 없는 소스 (getRepoTree 의 status="none")
//   - setup:       테스트 실행 명령 미설정 (Project.testCommand 가 비어 있음)

import type { FileEntry } from "@/lib/file-tree";

export interface Advisory {
  id: string;
  category: "coverage" | "reliability" | "setup";
  severity: "critical" | "warning";
  title: string;
  /** [code 앞, code 뒤] — 가운데에 아래 code 가 mono 로 들어간다. */
  detail: [before: string, after: string];
  code: string;
}

export function buildAdvisories(input: {
  testCommand: string | null;
  /** null = 레포 트리를 못 읽음(연결 끊김). 그럴 땐 coverage 판정을 건너뛴다. */
  entries: FileEntry[] | null;
  /** 최근 실패한 테스트 파일 경로 (test-metrics 의 getTestSummary). */
  failingTests: string[];
}): Advisory[] {
  const out: Advisory[] = [];

  // reliability — 지금 깨져 있는 것이 가장 급하므로 맨 앞·critical.
  for (const path of input.failingTests) {
    out.push({
      id: `reliability-${path}`,
      category: "reliability",
      severity: "critical",
      title: "Test keeps failing",
      detail: ["", " has failed recently."],
      code: path,
    });
  }

  // setup — 러너가 쓸 테스트 명령이 없으면 기본값으로 떨어진다.
  if (!input.testCommand) {
    out.push({
      id: "setup-no-command",
      category: "setup",
      severity: "warning",
      title: "No test command set",
      detail: ["Runs fall back to ", " until you set one in Runtime."],
      code: "npm test",
    });
  }

  // coverage — 테스트 파일이 없는 소스. 한 파일씩 카드를 찍으면 넘치므로
  // 건수로 요약하고 첫 파일을 예시로 붙인다.
  if (input.entries) {
    const untested = input.entries.filter((e) => e.status === "none");
    if (untested.length > 0) {
      const one = untested.length === 1;
      out.push({
        id: "coverage-untested",
        category: "coverage",
        severity: "warning",
        title: one ? "A component has no tests" : "Components have no tests",
        detail: [
          `${untested.length} source ${one ? "file has" : "files have"} no test yet — e.g. `,
          "",
        ],
        code: untested[0].path,
      });
    }
  }

  return out;
}
