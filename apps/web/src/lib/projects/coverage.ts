// 대시보드 Test coverage 의 집계. 순수 함수다.
//
// 분모는 레포의 소스 파일(GitHub 트리) 중 테스트를 만들 대상인 것이다 — 설정·테스트 준비 파일은
// 추천에서 빠지는 것과 같은 기준(test-targets.ts)으로 여기서도 뺀다. "테스트 있음"은 레포에 테스트 파일이 있거나
// Dante 에 저장된 테스트 버전이 있는 파일이다. 한 파일은 한 칸에만 들어간다.
// 상태는 그 파일 테스트의 최신 버전을 마지막으로 돌린 결과다.

import { isTestTarget } from "./test-targets.ts";

export type CoverageSource = { path: string; status: "has" | "none" };

export type Coverage = {
  /** 테스트를 만들 대상인 소스 파일 수 */
  sources: number;
  /** 그중 테스트가 있는 파일 수 = passed + failed + notRun */
  tested: number;
  passed: number;
  /** 테스트가 떨어졌거나(failed) 아예 못 돈(error) 파일 */
  failed: number;
  /** 테스트는 있지만 Dante 에서 돌린 결과가 없는 파일(돌고 있는 중도 포함) */
  notRun: number;
  /** 테스트가 없는 파일 */
  untested: number;
};

/**
 * @param runs 소스 경로 → 그 파일 테스트 최신 버전의 마지막 실행 상태(TestRun.status).
 *   Dante 에 버전은 있는데 돌린 적이 없으면 null. 버전이 없는 파일은 키가 없다.
 */
export function countCoverage(
  sources: CoverageSource[],
  runs: ReadonlyMap<string, string | null>
): Coverage {
  const targets = sources.filter((source) => isTestTarget(source.path));
  const coverage: Coverage = {
    sources: targets.length,
    tested: 0,
    passed: 0,
    failed: 0,
    notRun: 0,
    untested: 0,
  };

  for (const { path, status } of targets) {
    if (status === "none" && !runs.has(path)) {
      coverage.untested += 1;
      continue;
    }
    coverage.tested += 1;
    const run = runs.get(path);
    if (run === "passed") coverage.passed += 1;
    else if (run === "failed" || run === "error") coverage.failed += 1;
    else coverage.notRun += 1;
  }

  return coverage;
}
