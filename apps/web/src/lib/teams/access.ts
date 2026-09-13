// 팀 권한 검사 (서버 전용).
//
// 규칙은 AGENTS.md 그대로다. DB 는 서버에서만 읽고 RLS 정책은 없으므로, "이 사람이
// 이 팀 멤버인가"는 전부 여기서 검사한다. 여기를 거치지 않은 프로젝트 조회는 권한
// 검사가 없는 조회다.
//
// 멤버십은 요청 안에서만 dedup 하고 그 밖으로는 캐시하지 않는다. 팀에서 빠진 사람은
// 다음 요청부터 막혀야 한다(익스텐션 토큰 포함).

import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma, type TeamRole } from "@dante/db";
import { requireUser } from "@/lib/auth/user";

/** role 이 required 이상인가. owner 는 member 가 하는 일을 전부 한다. */
export function hasRole(role: TeamRole, required: TeamRole) {
  return required === "member" || role === "owner";
}

/** 이 사용자의 이 팀 역할. 멤버가 아니면 null. */
export const getTeamRole = cache(async (teamId: string, userId: string) => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
});

/**
 * 서버 액션·페이지 진입점. 로그인 + 멤버 확인 + (필요하면) 역할 확인.
 *
 * 멤버가 아니면 notFound() 다. 403 을 주면 "그런 팀이 있다"는 사실이 드러난다
 * (requireProjectContext 가 남의 프로젝트에 notFound 를 주는 것과 같다).
 * 멤버인데 역할이 모자라면 그때는 던진다 — 이미 팀이 보이는 사람이다.
 */
export async function requireTeamMember(teamId: string, required: TeamRole = "member") {
  const user = await requireUser();
  const role = await getTeamRole(teamId, user.id);
  if (!role) notFound();
  if (!hasRole(role, required)) {
    throw new Error("Only team owners can do this.");
  }
  return { user, teamId, role };
}

export type AccessibleProject = {
  id: string;
  ref: string;
  teamId: string;
  role: TeamRole;
};

/**
 * ref 가 이 사용자가 멤버인 팀의 프로젝트면 그 프로젝트와 역할, 아니면 null.
 *
 * userId 를 인자로 받는 이유: API v1 은 세션이 아니라 익스텐션 토큰으로 사람을
 * 알아낸다. requireUser() 를 안에서 부르면 그 경로에서 쓸 수 없다.
 *
 * 멤버십을 조건에 넣어 한 번에 읽는다. 프로젝트를 먼저 읽고 권한을 나중에 보면
 * 검사를 빠뜨린 호출부가 남의 프로젝트를 그대로 쓰게 된다.
 */
export const getAccessibleProject = cache(
  async (ref: string, userId: string): Promise<AccessibleProject | null> => {
    const row = await prisma.project.findFirst({
      where: { ref, team: { members: { some: { userId } } } },
      select: {
        id: true,
        ref: true,
        teamId: true,
        team: { select: { members: { where: { userId }, select: { role: true } } } },
      },
    });

    // teamId 가 비어 있는 행은 위 조건에 걸리지 않지만, 타입이 nullable 이라 한 번 더 좁힌다.
    const role = row?.team?.members[0]?.role;
    if (!row?.teamId || !role) return null;
    return { id: row.id, ref: row.ref, teamId: row.teamId, role };
  }
);
