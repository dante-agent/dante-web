// PR 에 되돌려줄 "한 번의 실행"을 담는 모양.
//
// 스캔·생성·실행은 아직 없다(Component/TestRun 모델도 없다). 그래서 이 파일은
// 렌더러가 요구하는 입력을 먼저 못박아 두는 자리다 — 파이프라인이 붙을 때
// 이 모양으로만 채워주면 코멘트·체크 쪽은 손대지 않아도 된다.
//
// GitHub 응답이나 Prisma 행을 그대로 흘려보내지 않는 이유는 lib/github/repos.ts
// 와 같다. 렌더러가 쓰는 필드가 무엇인지 여기 한 곳에 적혀 있어야 한다.

/**
 * 실행의 진행 단계. 하나의 코멘트가 이 상태들을 거쳐 간다 —
 * 단계마다 새 코멘트를 달면 PR 타임라인이 망가진다.
 */
export type RunStatus =
  /** PR 열림·푸시 감지 */
  | "queued"
  /** 컴포넌트 스캔 중 */
  | "scanning"
  /** 없거나 낡은 테스트 생성 중 */
  | "generating"
  /** 러너에 제출 */
  | "running"
  /** 실행이 끝남 (통과·실패는 totals 로 판단) */
  | "completed"
  /** 어느 단계든 실패 — 테스트 실패가 아니라 우리 쪽이 못 끝낸 것 */
  | "failed"
  /** 변경된 컴포넌트가 없어 할 일이 없었음 */
  | "unchanged";

/** 끝난 상태인지. 아니면 코멘트에 진행 표시만 그린다. */
export function isTerminal(status: RunStatus) {
  return status === "completed" || status === "failed" || status === "unchanged";
}

export type FailedTest = {
  /** 표시용 파일명. "src/…/Button.test.tsx" 처럼 경로여도 된다 */
  file: string;
  /** 테스트 이름 (describe › it 를 이어 붙인 것) */
  name: string;
  /** assertion 메시지 한 줄. 없을 수도 있다 */
  message: string | null;
};

export type ComponentChange = {
  name: string;
  change: "added" | "changed" | "removed";
  /** 이 컴포넌트에 딸린 테스트 수 */
  tests: number;
};

export type RunSummary = {
  status: RunStatus;
  totals: { total: number; passed: number; failed: number };
  failures: FailedTest[];
  components: ComponentChange[];
  /**
   * base 브랜치 대비 커버리지. 수집하지 않았으면 null 이고, 그때는 토글이
   * 켜져 있어도 그리지 않는다 — 없는 값을 "0%" 로 적으면 오해를 부른다.
   */
  coverage: { base: number | null; head: number } | null;
  durationMs: number | null;
  /** 단테 딥링크. 없으면 링크 줄을 그리지 않는다 */
  detailUrl: string | null;
  /** Check 상세의 Re-run 과 같은 동작을 코멘트에서도 걸어주는 링크 */
  rerunUrl: string | null;
  /** 우리 쪽이 실패했을 때(status === "failed") 사람이 읽을 사유 */
  error: string | null;
};

/**
 * PR 이 열리거나 푸시가 온 직후의 첫 상태.
 *
 * 스캔·생성·실행이 아직 없어서 지금은 이 상태에서 더 나아가지 않는다. 그래도
 * 먼저 코멘트를 만들어 두는 데는 이유가 있다 — sticky 코멘트는 "하나를 계속
 * 고쳐 쓰는" 것이고, 그 하나가 생기는 자리가 여기다. 파이프라인이 붙으면
 * 같은 코멘트를 scanning → running → completed 로 덮어쓰게 된다.
 */
export function queuedRun(links: {
  detailUrl: string | null;
  rerunUrl: string | null;
}): RunSummary {
  return {
    status: "queued",
    totals: { total: 0, passed: 0, failed: 0 },
    failures: [],
    components: [],
    coverage: null,
    durationMs: null,
    detailUrl: links.detailUrl,
    rerunUrl: links.rerunUrl,
    error: null,
  };
}

/**
 * 미리보기용 표본 둘.
 *
 * 설정 화면은 이 프로젝트의 가장 최근 실제 실행을 먼저 쓰고, 없으면 이걸 쓴다.
 * 실패 있음 / 전부 통과 두 가지가 다 필요한 이유는 "전부 통과 시 접기" 토글의
 * 결과가 그 둘에서만 갈리기 때문이다.
 */
export const SAMPLE_RUNS: Record<"failing" | "passing", RunSummary> = {
  failing: {
    status: "completed",
    totals: { total: 24, passed: 21, failed: 3 },
    failures: [
      {
        file: "Button.test.tsx",
        name: "renders disabled state",
        message: 'expected "true" to be "false"',
      },
      { file: "Card.test.tsx", name: "applies elevation", message: "snapshot mismatch" },
      { file: "Card.test.tsx", name: "forwards ref", message: "ref is null" },
    ],
    components: [
      { name: "Button", change: "changed", tests: 8 },
      { name: "Card", change: "added", tests: 11 },
      { name: "Badge", change: "added", tests: 5 },
    ],
    coverage: { base: 68, head: 71 },
    durationMs: 14_000,
    detailUrl: "https://dante.dev/project/sample/pull/42",
    rerunUrl: "https://dante.dev/project/sample/pull/42?rerun=1",
    error: null,
  },
  passing: {
    status: "completed",
    totals: { total: 24, passed: 24, failed: 0 },
    failures: [],
    components: [
      { name: "Button", change: "changed", tests: 8 },
      { name: "Card", change: "changed", tests: 11 },
      { name: "Badge", change: "added", tests: 5 },
    ],
    coverage: { base: 68, head: 71 },
    durationMs: 12_000,
    detailUrl: "https://dante.dev/project/sample/pull/42",
    rerunUrl: "https://dante.dev/project/sample/pull/42?rerun=1",
    error: null,
  },
};
