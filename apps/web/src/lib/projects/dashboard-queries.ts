// 프로젝트 대시보드가 읽는 값 (서버 전용).
//
// projectId 는 부르는 쪽이 소유 확인(getOwnedProjectId)을 마친 값이어야 한다.
// 프로젝트 스코프는 관계를 타고 좁힌다: TestRun → TestFileVersion → TestFile → Component(projectId)

import { prisma } from "@dante/db";
import { getRepoTree } from "@/lib/github/tree";
import { countCoverage, type Coverage } from "@/lib/projects/coverage";
import { getGeneratedSourcePaths } from "@/lib/projects/generated-versions";
import { pullRequestResult, type PullRequestResult } from "@/lib/projects/pull-request-result";
import type { ProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations, type TestRecommendation } from "@/lib/projects/recommendations";

/**
 * Test coverage. 파일 목록은 GitHub 트리(폴더 보기·추천과 같은 요청 캐시), 실행 상태는 DB.
 * 레포 테스트는 폴더 보기에서 열 때 이미 버전으로 저장되므로 따로 읽지 않는다.
 */
export async function getCoverage(repo: ProjectRepo, projectId: string): Promise<Coverage> {
  const [entries, testFiles] = await Promise.all([
    getRepoTree(repo),
    prisma.testFile.findMany({
      where: { component: { projectId } },
      select: {
        component: { select: { filePath: true } },
        // 폴더 보기가 보여주는 것과 같은 "최신" — getLatestGeneratedTest 도 createdAt 순이다.
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
        },
      },
    }),
  ]);

  const runs = new Map<string, string | null>();
  for (const testFile of testFiles) {
    const latest = testFile.versions[0];
    if (latest) runs.set(testFile.component.filePath, latest.runs[0]?.status ?? null);
  }
  return countCoverage(entries, runs);
}

export type RecentRun = {
  id: string;
  /** TestRun.status — "queued" | "running" | "passed" | "failed" | "error" */
  status: string;
  testPath: string;
  /** 테스트 대상 소스 경로. 줄을 누르면 이 파일의 폴더 보기로 간다. */
  sourcePath: string;
  /** 시작·끝이 다 있어야 안다. 못 돈(error 전) 실행이면 null. */
  durationMs: number | null;
  at: Date;
};

/** 대시보드 목록 줄 수. Recent runs 와 Up next 가 나란히 놓여 같은 값을 쓴다. */
export const DASHBOARD_LIST_LIMIT = 5;

export async function getRecentRuns(
  projectId: string,
  limit = DASHBOARD_LIST_LIMIT
): Promise<RecentRun[]> {
  const rows = await prisma.testRun.findMany({
    where: { testFileVersion: { testFile: { component: { projectId } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      testFileVersion: {
        select: {
          testFile: { select: { path: true, component: { select: { filePath: true } } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    testPath: row.testFileVersion.testFile.path,
    sourcePath: row.testFileVersion.testFile.component.filePath,
    durationMs:
      row.startedAt && row.finishedAt
        ? Math.max(0, row.finishedAt.getTime() - row.startedAt.getTime())
        : null,
    at: row.finishedAt ?? row.createdAt,
  }));
}

/**
 * Up next. AI Recommendations 의 Suggested 목록에서 Dante 가 이미 테스트를 만든 파일을 뺀다 —
 * 커버리지가 그 파일을 "테스트 있음"으로 세는데 여기서 또 추천하면 두 섹션이 어긋난다.
 * ponytail: 추천은 상위 30개로 잘린 뒤 거른다. 그중 대부분을 이미 만들었으면 5개보다 적게 나온다 —
 * 그때는 추천 쪽에서 먼저 거르게 옮긴다.
 */
export async function getUpNext(
  repo: ProjectRepo,
  projectId: string,
  limit = DASHBOARD_LIST_LIMIT
): Promise<TestRecommendation[]> {
  const [recommendations, generated] = await Promise.all([
    getTestRecommendations(repo),
    getGeneratedSourcePaths(projectId),
  ]);
  return recommendations.filter((r) => !generated.has(r.filePath)).slice(0, limit);
}

export type RecentPullRequest = PullRequestResult & { prNumber: number; at: Date };

/**
 * Pull requests. PR 마다 가장 최근 커밋의 작업 하나씩. 열림·닫힘은 보지 않는다.
 * superseded(새 커밋이 대신한 작업)는 결과가 없어 뺀다.
 */
export async function getRecentPullRequests(
  projectId: string,
  limit = 5
): Promise<RecentPullRequest[]> {
  // 한 PR 에 커밋마다 작업이 쌓인다. PR 단위로 줄이려고 넉넉히 받아 앞에서부터 고른다.
  const jobs = await prisma.pullRequestJob.findMany({
    where: { projectId, status: { not: "superseded" } },
    orderBy: { createdAt: "desc" },
    take: limit * 4,
    select: { prNumber: true, status: true, error: true, runResult: true, updatedAt: true },
  });

  const seen = new Set<number>();
  const pulls: RecentPullRequest[] = [];
  for (const job of jobs) {
    if (seen.has(job.prNumber)) continue;
    seen.add(job.prNumber);
    pulls.push({ prNumber: job.prNumber, at: job.updatedAt, ...pullRequestResult(job) });
    if (pulls.length === limit) break;
  }
  return pulls;
}
