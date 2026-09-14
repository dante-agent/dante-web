import { prisma } from "@dante/db";

export type GeneratedSession = {
  id: string;
  title: string;
  status: "needs_clarification" | "in_progress" | "completed";
  updatedAt: string;
};

/** 사용자가 AI로 테스트 코드를 생성해 저장한 버전을 최신순으로 조회한다. */
export async function getGeneratedSessions(
  projectRef: string,
  userId: string,
  limit = 30
): Promise<GeneratedSession[]> {
  const versions = await prisma.testFileVersion.findMany({
    where: {
      source: "ai",
      testFile: { component: { project: { ref: projectRef, userId } } },
    },
    select: {
      id: true,
      createdAt: true,
      version: true,
      testFile: { select: { component: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return versions.map((version) => ({
    id: version.id,
    title: `${version.testFile.component.name} 테스트 생성 (v${version.version})`,
    status: "completed",
    updatedAt: version.createdAt.toISOString(),
  }));
}
