// 지금 보고 있는 팀 (서버 전용).
//
// 프로젝트 목록과 새 GitHub 설치는 "지금 팀" 기준이다. 그 값은 쿠키에 둔다 — URL 에
// 넣으면 /projects 같은 팀 밖 경로가 전부 팀 id 를 달아야 한다(결정 7).
//
// 쿠키는 믿지 않는다. 읽을 때마다 멤버십을 다시 본다. 팀에서 빠졌거나 팀이 지워졌으면
// 쿠키를 지우지 않고도 개인 팀으로 떨어진다 — 개인 팀은 항상 있다(personal.ts).
//
// 프로젝트 화면(/project/<ref>)의 팀은 쿠키가 아니라 그 프로젝트의 팀이다. 다른 팀
// 프로젝트 링크를 열었는데 헤더가 엉뚱한 팀을 가리키면 안 된다.

import { cache } from "react";
import { cookies } from "next/headers";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@dante/db";
import { requireUser, syncUser } from "@/lib/auth/user";
import { getTeamRole, isTeamId } from "@/lib/teams/access";

export const CURRENT_TEAM_COOKIE = "dante_team";

/** 헤더 스위처와 목록에 넘기는 모양. 클라이언트로 가도 되는 값만 둔다. */
export type TeamOption = { id: string; name: string };

/** 지금 팀 id. 쿠키가 없거나 더는 멤버가 아닌 팀이면 개인 팀. */
export const getCurrentTeamId = cache(async (user: SupabaseUser) => {
  const chosen = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value;
  if (chosen && isTeamId(chosen) && (await getTeamRole(chosen, user.id))) return chosen;

  // syncUser 를 거쳐야 아직 미러되지 않은 사용자도 개인 팀을 가진 채로 돌아온다.
  const { personalTeamId } = await syncUser(user);
  return personalTeamId;
});

/** 이 사용자가 멤버인 팀들. 들어간 순서대로 — 개인 팀이 맨 위에 온다. */
export const listTeams = cache(async (userId: string): Promise<TeamOption[]> => {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { team: { select: { id: true, name: true } } },
  });
  return rows.map((row) => row.team);
});

/**
 * 페이지 진입점. 로그인 + 지금 팀 + 팀 목록.
 * 순서대로 부른다 — 처음 온 사용자는 getCurrentTeamId 가 개인 팀을 만든 뒤에야 목록에 잡힌다.
 */
export async function requireCurrentTeam() {
  const user = await requireUser();
  const teamId = await getCurrentTeamId(user);
  const teams = await listTeams(user.id);
  return { user, teamId, teams };
}

/** 서버 액션·라우트 핸들러에서만 부른다. 렌더 중에는 쿠키를 쓸 수 없다. */
export async function rememberCurrentTeam(teamId: string) {
  (await cookies()).set(CURRENT_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
