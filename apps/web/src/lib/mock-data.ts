// 목업 데이터 — 화면 레이아웃 확인용. GitHub App 설치 연동 PR(레포 목록 Import)에서
// 이 파일은 통째로 삭제한다.
//
// 프로젝트 목록(/projects)은 실제 Project 조회로 교체됐지만(src/lib/projects.ts),
// GitHub App 설치도 레포 Import 화면(/projects/new)도 아직 없어서 그쪽은 여전히
// 이 고정값을 쓴다.

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
