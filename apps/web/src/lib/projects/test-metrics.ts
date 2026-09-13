// 대시보드 Usage 섹션의 실행·생성 지표 (서버 전용).
//
// Test runs 는 TestRun, Generations 는 TestFileVersion(AI 생성분)에서 센다.
// 두 테이블 다 러너/생성 파이프라인이 붙어야 채워진다(ADR-0001) — 그전엔 0 이
// 나오고, 붙는 즉시 이 조회가 그대로 실데이터를 그린다.
//
// 프로젝트 스코프는 관계를 타고 좁힌다:
//   TestRun → TestFileVersion → TestFile → Component(projectId)

import { prisma } from "@dante/db";
import { activityWindow, dayIndex, emptyBuckets, type ActivitySeries } from "./window";

export interface TestActivity {
  testRuns: ActivitySeries;
  generations: ActivitySeries;
}

export interface TestSummary {
  /** 이 프로젝트의 전체 실행 횟수 (SuitePanel "Runs"). */
  runsTotal: number;
  /** passed / (passed+failed) *100, 소수 1자리. 판정된 실행이 없으면 null → "—". */
  passRate: number | null;
  /** 가장 최근 실행 시각 (Hero "Last run"). 없으면 null. */
  lastRunAt: Date | null;
  /** 가장 최근 AI 생성 시각 (Hero "Last generated"). 없으면 null. */
  lastGeneratedAt: Date | null;
  /** 최근 실패/에러한 테스트 파일 경로 (Advisor reliability). 중복 제거, 최대 3개. */
  failingTests: string[];
}

/**
 * SuitePanel·Hero·Advisor 가 쓰는 실행 요약. 러너가 붙기 전엔 전부 0/null 이고,
 * 붙는 즉시 같은 조회가 실데이터를 준다. 프로젝트 스코프는 관계를 타고 좁힌다.
 */
export async function getTestSummary(projectId: string): Promise<TestSummary> {
  const scope = { testFileVersion: { testFile: { component: { projectId } } } };

  const [total, passed, failed, lastRun, lastGen, failingRuns] = await Promise.all([
    prisma.testRun.count({ where: scope }),
    prisma.testRun.count({ where: { ...scope, status: "passed" } }),
    prisma.testRun.count({ where: { ...scope, status: "failed" } }),
    prisma.testRun.findFirst({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: { finishedAt: true, createdAt: true },
    }),
    prisma.testFileVersion.findFirst({
      where: { source: "ai", testFile: { component: { projectId } } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.testRun.findMany({
      where: { ...scope, status: { in: ["failed", "error"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { testFileVersion: { select: { testFile: { select: { path: true } } } } },
    }),
  ]);

  const decided = passed + failed;
  const passRate = decided === 0 ? null : Math.round((passed / decided) * 1000) / 10;

  const seen = new Set<string>();
  const failingTests: string[] = [];
  for (const r of failingRuns) {
    const path = r.testFileVersion.testFile.path;
    if (seen.has(path)) continue;
    seen.add(path);
    failingTests.push(path);
    if (failingTests.length >= 3) break;
  }

  return {
    runsTotal: total,
    passRate,
    lastRunAt: lastRun ? (lastRun.finishedAt ?? lastRun.createdAt) : null,
    lastGeneratedAt: lastGen?.createdAt ?? null,
    failingTests,
  };
}

export async function getTestActivity(projectId: string): Promise<TestActivity> {
  const { from } = activityWindow();

  const [runs, gens] = await Promise.all([
    prisma.testRun.findMany({
      where: {
        createdAt: { gte: from },
        testFileVersion: { testFile: { component: { projectId } } },
      },
      select: { status: true, createdAt: true },
    }),
    prisma.testFileVersion.findMany({
      where: {
        createdAt: { gte: from },
        source: "ai",
        testFile: { component: { projectId } },
      },
      select: { createdAt: true },
    }),
  ]);

  const runPoints = emptyBuckets();
  let runTotal = 0;
  let runFailed = 0;
  let runErrors = 0;
  for (const r of runs) {
    if (r.status === "failed") runFailed += 1;
    else if (r.status === "error") runErrors += 1;
    runPoints[dayIndex(r.createdAt, from)] += 1;
    runTotal += 1;
  }

  const genPoints = emptyBuckets();
  for (const g of gens) genPoints[dayIndex(g.createdAt, from)] += 1;

  return {
    testRuns: {
      key: "test-runs",
      label: "Test runs",
      total: runTotal,
      failed: runFailed,
      errors: runErrors,
      points: runPoints,
    },
    generations: {
      key: "generations",
      label: "Generations",
      total: gens.length,
      failed: 0,
      errors: 0,
      points: genPoints,
    },
  };
}
