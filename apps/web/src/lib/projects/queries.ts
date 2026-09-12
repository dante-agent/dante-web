// 프로젝트 조회 (서버 전용). 소유자(userId) 스코프. 팀 도입 시 여기가 teamId 로 바뀐다.

import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { projectConnection, type ConnectionStatus } from "@/lib/github/connection";

export type ProjectSummary = {
  ref: string;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
};

const summarySelect = {
  ref: true,
  name: true,
  repoOwner: true,
  repoName: true,
  defaultBranch: true,
} as const;

/** 이 사용자의 프로젝트 전부. 최근 생성 순. 헤더 스위처·목록용. */
export function listProjects(userId: string): Promise<ProjectSummary[]> {
  return prisma.project.findMany({
    where: { userId },
    select: summarySelect,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 프로젝트 스코프 레이아웃 진입점. 로그인 + 소유 확인.
 * ref 에 해당하는 프로젝트가 없거나 남의 것이면 notFound().
 * 목록도 같이 돌려준다 — 헤더가 필요로 하고, 조회 한 번으로 끝난다.
 */
export async function requireProjectContext(ref: string) {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  const project = projects.find((p) => p.ref === ref);
  if (!project) notFound();
  return { user, project, projects };
}

/** 대시보드 히어로가 그리는 값. 지표(테스트 수·통과율)는 아직 목업이다. */
export type DashboardProject = ProjectSummary & {
  testFramework: string | null;
  connection: ConnectionStatus;
};

/**
 * 요약(ProjectSummary)에 러너 이름과 연결 상태를 얹어서 한 번에 읽는다.
 * 레이아웃의 requireProjectContext 로는 두 값을 알 수 없어 대시보드만 한 번 더 읽는다.
 */
export async function getDashboardProject(
  ref: string,
  userId: string
): Promise<DashboardProject | null> {
  const row = await prisma.project.findFirst({
    where: { ref, userId },
    select: {
      ...summarySelect,
      testFramework: true,
      // 연결 상태는 프로젝트와 설치 두 군데에 나뉘어 적힌다 (lib/github/connection.ts).
      disconnectedAt: true,
      disconnectedReason: true,
      installation: { select: { suspendedAt: true, deletedAt: true } },
    },
  });
  if (!row) return null;

  const { disconnectedAt, disconnectedReason, installation, ...summary } = row;
  return {
    ...summary,
    connection: projectConnection({ disconnectedAt, disconnectedReason, installation }),
  };
}

/** GitHub 호출에 필요한 필드. installationId(BigInt)가 있어 클라이언트로 넘기지 않는다. */
export type ProjectRepo = {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
};

/**
 * ref 가 내 프로젝트면 내부 id, 아니면 null.
 *
 * ProjectRepo 에 id 를 끼워 넣지 않은 이유: 그 타입은 "GitHub 호출에 필요한 필드"
 * 라서, 관계없는 값이 섞이면 무엇을 위한 묶음인지가 흐려진다. 사용량 기록처럼
 * 내부 id 만 필요한 자리가 따로 있으니 조회도 따로 둔다.
 */
export const getOwnedProjectId = cache(
  async (ref: string, userId: string): Promise<string | null> => {
    const row = await prisma.project.findFirst({
      where: { ref, userId },
      select: { id: true },
    });
    return row?.id ?? null;
  }
);

/** layout·page 가 같은 요청에서 각각 부르므로 cache 로 dedup. */
export const getProjectRepo = cache((ref: string, userId: string): Promise<ProjectRepo | null> =>
  prisma.project.findFirst({
    where: { ref, userId },
    select: { repoOwner: true, repoName: true, defaultBranch: true, installationId: true },
  })
);
