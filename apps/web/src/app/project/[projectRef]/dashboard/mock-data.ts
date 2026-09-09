// 데이터 연결 전까지 대시보드 레이아웃을 잡기 위한 목업. 실제 조회 붙이면 이 파일은 삭제.

export type BuildType = "iOS" | "Android" | "Web" | "API";

export interface TeamMember {
  id: string;
  name: string;
}

export interface PullRequestSummary {
  id: string;
  repo: string;
  number: number;
  title: string;
  status: "open" | "merged" | "closed";
  author: string;
  updatedAt: string;
  url: string;
}

export interface FolderTestShare {
  name: string;
  count: number;
  pct: number;
}

export interface AiUsageSlice {
  label: string;
  pct: number;
}

export const dashboardMock = {
  project: {
    name: "Dante Web",
    createdAt: "2026-06-02T00:00:00+09:00",
    updatedAt: "2026-09-08T09:12:00+09:00",
  },
  team: {
    type: "team" as "team" | "personal",
    members: [
      { id: "1", name: "이수현" },
      { id: "2", name: "김도윤" },
      { id: "3", name: "박서연" },
    ] as TeamMember[],
  },
  tests: {
    totalCases: 128,
    buildTypes: ["iOS", "Android", "Web"] as BuildType[],
    passed: 104,
    failed: 9,
    lastRunAt: "2026-09-07T18:32:00+09:00",
  },
  ai: {
    provider: "Anthropic",
    model: "claude-sonnet-4-6",
    running: true,
    currentTask: "로그인 모듈 테스트 생성 중...",
    tokensUsed: 128_400,
    tokenLimit: 500_000,
  },
  folderTestRatio: {
    totalFiles: 128,
    folders: [
      { name: "components/", count: 58, pct: 45 },
      { name: "api/", count: 35, pct: 27 },
      { name: "hooks/", count: 23, pct: 18 },
      { name: "utils/", count: 12, pct: 10 },
    ] as FolderTestShare[],
  },
  aiUsageBreakdown: [
    { label: "테스트 생성", pct: 42 },
    { label: "테스트 실행", pct: 28 },
    { label: "리포트 생성", pct: 18 },
    { label: "디버깅", pct: 12 },
  ] as AiUsageSlice[],
  // 최근 91일(13주) 커밋 활동. 0(없음) ~ 4(많음). 표시는 오래된 날짜 → 최신순.
  commitHeatmap: [
    0, 1, 0, 2, 0, 3, 1, 0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 1, 0, 2, 3, 0, 1,
    0, 1, 3, 0, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 3, 0, 0, 1, 0, 2, 0, 1, 0, 3, 1, 0, 0, 2, 0, 1, 2, 0,
    1, 0, 1, 0, 2, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 0, 2, 1, 0, 3, 0, 4, 2, 0, 1, 3, 2,
  ],
  pullRequests: [
    {
      id: "pr-1",
      repo: "dante-web",
      number: 128,
      title: "feat(dashboard): 대시보드 목업 레이아웃 추가",
      status: "open",
      author: "isuhyeon",
      updatedAt: "2026-09-08T09:12:00+09:00",
      url: "#",
    },
    {
      id: "pr-2",
      repo: "dante-web",
      number: 127,
      title: "fix(runner): 빌드 타임아웃 시 재시도 로직 추가",
      status: "merged",
      author: "dyoon",
      updatedAt: "2026-09-07T15:40:00+09:00",
      url: "#",
    },
    {
      id: "pr-3",
      repo: "dante-extension",
      number: 42,
      title: "refactor(auth): 토큰 갱신 흐름 정리",
      status: "merged",
      author: "seoyeon",
      updatedAt: "2026-09-06T11:05:00+09:00",
      url: "#",
    },
    {
      id: "pr-4",
      repo: "dante-web",
      number: 125,
      title: "chore(deps): next 16.3.4로 업그레이드",
      status: "closed",
      author: "isuhyeon",
      updatedAt: "2026-09-04T09:20:00+09:00",
      url: "#",
    },
  ] as PullRequestSummary[],
};
