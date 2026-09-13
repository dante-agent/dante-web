// 대시보드 지표 목업 — 이제 딱 하나 남았다.
//
// 나머지는 전부 실데이터다: 프로젝트·연결 상태(getDashboardProject), 테스트·컴포넌트
// 수(getRepoStats), Usage 의 Test runs·Generations(test-metrics)·PR comments·Check
// runs(activity), SuitePanel·Hero·Advisor 의 실행 지표(getTestSummary), Advisor
// 판정(advisories). 여기 남은 것:
//   - usage.webhooks: 웹훅 배달 건수 — 배달 로깅이 붙기 전까지 소스 없음
// 이것이 붙으면 이 파일은 사라진다.

/** 지표 줄의 카드 하나. 우리가 GitHub·러너에 남기는 활동을 표면별로 나눈 것. */
export interface UsageSeries {
  key: string;
  label: string;
  total: number;
  failed: number;
  errors: number;
  /** 막대 하나 = 한 구간. 값이 0 이면 막대를 그리지 않는다. */
  points: number[];
}

export const dashboardMock = {
  usage: {
    series: [
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
};
