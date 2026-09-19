import { unstable_cache } from "next/cache";
import { cache } from "react";
import { prisma } from "@dante/db";
import { fetchFileText, installationClient } from "@/lib/github/pull-request";
import { accessibleProjectWhere } from "@/lib/teams/access";

// ⚠️ 서버 전용. PR preview 화면(/project/[ref]/pull/[n])이 읽는 한 PR 의 가장 최근 작업.
//
// 레이아웃(파일 트리)과 페이지(에디터·결과)가 같은 요청에서 둘 다 부른다. cache 로 한 번만 읽는다.
// 여기서는 목록에 쓰는 가벼운 값만 읽는다. 러너 로그·테스트 코드는 크고 화면마다 하나만 쓰므로
// 필요한 화면에서 따로 읽는다(getPullRequestRun, getPullRequestTestCode) — 파일을 누를 때마다
// 로그와 모든 테스트 코드를 다시 읽지 않게.

export const getPullRequestPreview = cache(
  async (projectRef: string, userId: string, prNumber: number) => {
    const project = await prisma.project.findFirst({
      where: { ref: projectRef, ...accessibleProjectWhere(userId) },
      select: { id: true, repoOwner: true, repoName: true, installationId: true },
    });
    if (!project) return null;

    const job = await prisma.pullRequestJob.findFirst({
      where: { projectId: project.id, prNumber },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        headSha: true,
        status: true,
        error: true,
        tests: {
          orderBy: { filePath: "asc" },
          select: { id: true, filePath: true, testPath: true },
        },
      },
    });

    return { project, job };
  }
);

/**
 * 실행 결과와 러너 로그. 파일을 고르기 전 화면(결과 요약)만 쓴다.
 * jobId 는 getPullRequestPreview 가 권한을 확인하고 돌려준 값이어야 한다.
 */
export async function getPullRequestRun(jobId: string) {
  return prisma.pullRequestJob.findUnique({
    where: { id: jobId },
    select: { runResult: true, runLogs: true },
  });
}

/**
 * 테스트 하나의 코드. 파일을 골랐을 때 그 파일 것만 읽는다.
 * testId 는 getPullRequestPreview 가 권한을 확인하고 돌려준 값이어야 한다.
 */
export async function getPullRequestTestCode(testId: string) {
  const row = await prisma.pullRequestTest.findUnique({
    where: { id: testId },
    select: { code: true },
  });
  return row?.code ?? null;
}

/** 소스 캐시 보관 기간(초). 키에 커밋 sha 가 있어 내용은 안 바뀐다 — 오래 쓰지 않는 항목을 비우려는 값. */
const SOURCE_TTL_SECONDS = 60 * 60 * 24;

/** 캐시에 담지 않을 결과(못 읽음)를 알리는 표시. */
class SourceUnavailable extends Error {}

/**
 * PR head 커밋의 소스 파일. 파일을 누를 때마다 GitHub 에 다시 묻지 않도록 캐시한다.
 *
 * 키는 설치 + 레포 + 커밋 sha + 경로다. sha 로 고정된 내용이라 바뀌지 않는다. 설치를 키에 넣는
 * 이유: 같은 레포를 다른 팀이 연결했어도 각자 자기 설치 권한으로 읽은 값만 보게.
 * 못 읽은 결과(null)는 담지 않는다 — 잠깐의 GitHub 오류가 굳지 않게.
 */
export async function getPullRequestSource(args: {
  installationId: bigint;
  owner: string;
  repo: string;
  path: string;
  sha: string;
}): Promise<string | null> {
  const { installationId, owner, repo, path, sha } = args;
  const load = unstable_cache(
    async () => {
      const octokit = await installationClient(installationId);
      const text = await fetchFileText(octokit, { owner, repo }, path, sha);
      if (text === null) throw new SourceUnavailable();
      return text;
    },
    ["pr-preview-source", installationId.toString(), owner, repo, sha, path],
    { revalidate: SOURCE_TTL_SECONDS }
  );
  try {
    return await load();
  } catch (error) {
    if (error instanceof SourceUnavailable) return null;
    throw error;
  }
}

/** URL 의 PR 번호. 양의 정수가 아니면 null */
export function parsePrNumber(value: string) {
  const prNumber = Number(value);
  return Number.isSafeInteger(prNumber) && prNumber > 0 ? prNumber : null;
}
