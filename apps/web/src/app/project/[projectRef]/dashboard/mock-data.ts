// 대시보드 지표 목업.
//
// 프로젝트 이름·레포·기본 브랜치·테스트 러너·연결 상태는 목업이 아니라 DB 값이다
// (`lib/projects/queries.ts` 의 `getDashboardProject`). 여기 있는 건 아직 쌓이는
// 곳이 없는 값들 — TestRun 은 러너가 붙어야(ADR-0001) 채워지고, Component/TestFile
// 집계와 Advisor 판정은 생성 기능이 들어온 뒤에나 계산할 수 있다.
// 실제 조회가 붙으면 이 파일은 통째로 사라진다.

/** 지표 줄의 카드 하나. 우리가 GitHub·러너에 남기는 활동을 표면별로 나눈 것. */
export interface UsageSeries {
  key: string;
  label: string;
  total: number;
  /** 테스트가 정상적으로 돌고 떨어진 수 (TestRun.status = "failed"). */
  failed: number;
  /** 실행 자체가 안 된 수 (TestRun.status = "error"). */
  errors: number;
  /** 막대 하나 = 한 구간. 값이 0 이면 막대를 그리지 않는다. */
  points: number[];
}

export interface Advisory {
  id: string;
  category: "coverage" | "reliability" | "setup";
  severity: "critical" | "warning";
  title: string;
  /** [code 앞, code 뒤] — 가운데에 아래 code 가 mono 로 들어간다. */
  detail: [before: string, after: string];
  code: string;
}

export const dashboardMock = {
  // 히어로 우측 패널 + 좌측 "LAST RUN / LAST GENERATED" 칸.
  suite: {
    testFiles: 128,
    components: 64,
    passRate: 91.3,
    lastRunAt: "2026-09-12T18:32:00+09:00",
    lastGeneratedAt: "2026-09-12T15:04:00+09:00",
  },
  usage: {
    from: "2026-09-05T00:00:00+09:00",
    to: "2026-09-12T00:00:00+09:00",
    series: [
      {
        key: "test-runs",
        label: "Test runs",
        total: 312,
        failed: 27,
        errors: 4,
        points: [
          4, 2, 0, 9, 6, 3, 0, 0, 12, 18, 7, 4, 2, 0, 5, 22, 14, 9, 3, 0, 0, 8, 31, 17, 6, 2, 11, 5,
        ],
      },
      {
        key: "generations",
        label: "Generations",
        total: 186,
        failed: 0,
        errors: 2,
        points: [
          0, 3, 5, 2, 0, 0, 7, 11, 4, 2, 0, 6, 9, 3, 0, 0, 14, 8, 5, 2, 0, 4, 19, 7, 3, 0, 6, 2,
        ],
      },
      {
        key: "pr-comments",
        label: "PR comments",
        total: 74,
        failed: 0,
        errors: 0,
        points: [
          0, 1, 0, 3, 2, 0, 0, 4, 6, 1, 0, 2, 0, 5, 3, 0, 0, 7, 2, 1, 0, 0, 9, 4, 2, 0, 3, 1,
        ],
      },
      {
        key: "check-runs",
        label: "Check runs",
        total: 71,
        failed: 6,
        errors: 1,
        points: [
          0, 1, 0, 3, 2, 0, 0, 4, 5, 1, 0, 2, 0, 4, 3, 0, 0, 6, 2, 1, 0, 0, 8, 4, 2, 0, 3, 1,
        ],
      },
      {
        key: "webhooks",
        label: "Webhooks",
        total: 240,
        failed: 0,
        errors: 0,
        points: [
          6, 4, 2, 11, 8, 3, 0, 5, 14, 9, 6, 3, 2, 7, 12, 18, 10, 5, 3, 2, 0, 9, 21, 13, 7, 4, 8, 6,
        ],
      },
    ] as UsageSeries[],
  },
  advisories: [
    {
      id: "adv-1",
      category: "coverage",
      severity: "critical",
      title: "Component has no tests",
      detail: ["Component ", " is exported but has no test file."],
      code: "src/checkout/CartSummary.tsx",
    },
    {
      id: "adv-2",
      category: "reliability",
      severity: "warning",
      title: "Test keeps failing",
      detail: ["", " has failed the last 5 runs."],
      code: "src/auth/useSession.test.ts",
    },
    {
      id: "adv-3",
      category: "setup",
      severity: "warning",
      title: "No test command set",
      detail: ["Runs fall back to ", " until you set one in Runtime."],
      code: "npm test",
    },
  ] as Advisory[],
};
