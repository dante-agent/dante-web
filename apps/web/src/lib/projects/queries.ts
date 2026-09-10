// 프로젝트 조회 (서버 전용). 소유자(userId) 스코프. 팀 도입 시 여기가 teamId 로 바뀐다.

import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";

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

/** GitHub 호출에 필요한 필드. installationId(BigInt)가 있어 클라이언트로 넘기지 않는다. */
export type ProjectRepo = {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
};

/** layout·page 가 같은 요청에서 각각 부르므로 cache 로 dedup. */
export const getProjectRepo = cache((ref: string, userId: string): Promise<ProjectRepo | null> =>
  prisma.project.findFirst({
    where: { ref, userId },
    select: { repoOwner: true, repoName: true, defaultBranch: true, installationId: true },
  })
);
