import { cache } from "react";
import { prisma } from "@dante/db";
import { accessibleProjectWhere } from "@/lib/teams/access";

// ⚠️ 서버 전용. PR preview 화면(/project/[ref]/pull/[n])이 읽는 한 PR 의 가장 최근 작업.
//
// 레이아웃(파일 트리)과 페이지(에디터·결과)가 같은 요청에서 둘 다 부른다. cache 로 한 번만 읽는다.

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
        headSha: true,
        status: true,
        error: true,
        runResult: true,
        runLogs: true,
        tests: {
          orderBy: { filePath: "asc" },
          select: { filePath: true, testPath: true, code: true },
        },
      },
    });

    return { project, job };
  }
);

/** URL 의 PR 번호. 양의 정수가 아니면 null */
export function parsePrNumber(value: string) {
  const prNumber = Number(value);
  return Number.isSafeInteger(prNumber) && prNumber > 0 ? prNumber : null;
}
