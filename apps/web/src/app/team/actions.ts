"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { requireUser, syncUser } from "@/lib/auth/user";
import { getTeamRole, isTeamId } from "@/lib/teams/access";
import { rememberCurrentTeam } from "@/lib/teams/current";
import * as manage from "@/lib/teams/manage";

// 팀 밖에서 부르는 팀 액션: 지금 팀 바꾸기, 새 팀 만들기.

/**
 * 지금 팀을 바꾸고 next 로 보낸다.
 *
 * 멤버가 아닌 팀이면 아무것도 하지 않는다. 쿠키에 넣어 봐야 읽을 때 걸러지지만
 * (current.ts), 남의 팀 id 를 받아 적어 둘 이유가 없다.
 */
export async function switchTeam(teamId: string, next: string) {
  const user = await requireUser();
  if (!isTeamId(teamId) || !(await getTeamRole(teamId, user.id))) return;

  await rememberCurrentTeam(teamId);
  // 헤더·목록이 전부 지금 팀을 따라 그려지므로 레이아웃째 새로 그린다.
  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export type CreateTeamState = { message: string } | null;

/** 새 팀. 만든 사람이 owner 가 되고, 지금 팀이 되고, 초대하러 멤버 화면으로 간다. */
export async function createTeam(
  _prev: CreateTeamState,
  formData: FormData
): Promise<CreateTeamState> {
  const user = await requireUser();
  // 멤버십이 public.users 행을 참조한다. 계정 설정만 오간 사용자는 아직 없을 수 있다.
  await syncUser(user);

  const result = await manage.createTeam(user.id, String(formData.get("name") ?? ""));
  if (!result.ok) return { message: result.message };

  await rememberCurrentTeam(result.teamId);
  revalidatePath("/", "layout");
  redirect(`/team/${result.teamId}/settings/members`);
}
