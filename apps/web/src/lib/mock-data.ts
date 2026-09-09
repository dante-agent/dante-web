// 목업 데이터 — 화면 레이아웃 확인용. DB·Octokit 연동 PR에서 이 파일은 통째로 삭제한다.
//
// 지금은 GitHub App 설치도, Project 테이블도 없다. 그래서 화면이 어떤 상태를
// 그려야 하는지(프로젝트 0개 / 미연결 / 레포 목록)를 여기서 고정값으로 준다.

import type { FileEntry } from "@/lib/file-tree";

export type MockProject = {
  /** URL 에 쓰는 불투명 식별자. 레포 이름을 쓰지 않는 이유는 rename·이관 때문. */
  ref: string;
  name: string;
  repoFullName: string;
  defaultBranch: string;
  /** 테스트 파일 개수 */
  testCount: number;
  /** 마지막 실행 통과율(0~1). null 이면 아직 한 번도 안 돌린 프로젝트. */
  passRate: number | null;
};

export type MockRepo = {
  /** GitHub 숫자 ID. rename·이관돼도 이걸로 추적한다. */
  id: number;
  owner: string;
  name: string;
  private: boolean;
  language: string | null;
  /** 마지막 푸시 시각 (ISO) */
  pushedAt: string;
  /** 이미 Dante 프로젝트로 등록된 레포인지 */
  importedAs: string | null;
};

export const mockProjects: MockProject[] = [
  {
    ref: "kqv8m2xrp4td",
    name: "web-app",
    repoFullName: "acme/web-app",
    defaultBranch: "main",
    testCount: 128,
    passRate: 0.96,
  },
  {
    ref: "b7fz3nwqj1ls",
    name: "design-system",
    repoFullName: "acme/design-system",
    defaultBranch: "main",
    testCount: 41,
    passRate: 0.78,
  },
  {
    ref: "h4td9cvmk6ea",
    name: "checkout-flow",
    repoFullName: "seojigwon/checkout-flow",
    defaultBranch: "develop",
    testCount: 0,
    passRate: null,
  },
];

export const mockRepos: MockRepo[] = [
  {
    id: 812_004_113,
    owner: "acme",
    name: "web-app",
    private: true,
    language: "TypeScript",
    pushedAt: "2026-09-06T09:12:00Z",
    importedAs: "kqv8m2xrp4td",
  },
  {
    id: 812_004_298,
    owner: "acme",
    name: "api-server",
    private: true,
    language: "Go",
    pushedAt: "2026-09-01T14:30:00Z",
    importedAs: null,
  },
  {
    id: 799_331_007,
    owner: "acme",
    name: "design-system",
    private: false,
    language: "TypeScript",
    pushedAt: "2026-08-19T02:45:00Z",
    importedAs: "b7fz3nwqj1ls",
  },
  {
    id: 765_120_884,
    owner: "acme",
    name: "infra-terraform",
    private: true,
    language: "HCL",
    pushedAt: "2026-07-28T22:10:00Z",
    importedAs: null,
  },
  {
    id: 690_442_015,
    owner: "seojigwon",
    name: "checkout-flow",
    private: false,
    language: "TypeScript",
    pushedAt: "2026-09-07T11:05:00Z",
    importedAs: "h4td9cvmk6ea",
  },
  {
    id: 690_441_772,
    owner: "seojigwon",
    name: "dotfiles",
    private: false,
    language: null,
    pushedAt: "2026-05-02T08:00:00Z",
    importedAs: null,
  },
];

/** 설치된 GitHub App 이 접근할 수 있는 계정 목록 (개인 + 조직). */
export const mockOwners = ["acme", "seojigwon"];

// 폴더 보기 서브 사이드바용. 연결된 레포의 소스 파일 목록 = GitHub `git/trees?recursive=1`
// 응답에서 확장자 필터를 통과한 blob 들. status 는 나중에 테스트 존재/신선도로 계산할 값.
// `*.test.*` 는 항목에 없다 — 소스의 status 로만 표현.
export const mockFileTree: FileEntry[] = [
  { path: "src/app/layout.tsx", status: "none" },
  { path: "src/app/page.tsx", status: "none" },
  { path: "src/app/dashboard/page.tsx", status: "has" },
  { path: "src/app/dashboard/loading.tsx", status: "none" },
  { path: "src/components/Button.tsx", status: "has" },
  { path: "src/components/Card.tsx", status: "none" },
  { path: "src/components/Modal.tsx", status: "none" },
  { path: "src/components/icons/Logo.tsx", status: "none" },
  { path: "src/hooks/useAuth.ts", status: "has" },
  { path: "src/hooks/useDebounce.ts", status: "has" },
  { path: "src/hooks/useLocalStorage.ts", status: "none" },
  { path: "src/lib/api.ts", status: "has" },
  { path: "src/lib/format.ts", status: "has" },
  { path: "src/lib/validate.ts", status: "has" },
  { path: "src/lib/utils.ts", status: "none" },
  { path: "src/features/checkout/steps/Payment.tsx", status: "none" },
  { path: "src/features/checkout/steps/Review.tsx", status: "has" },
  { path: "src/store/cart.ts", status: "has" },
  { path: "src/store/user.ts", status: "none" },
  { path: "src/worker.js", status: "none" },
  { path: "src/legacy/jquery-shim.jsx", status: "none" },
];
