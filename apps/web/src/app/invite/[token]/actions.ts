"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, syncUser } from "@/lib/auth/user";
import { rememberCurrentTeam } from "@/lib/teams/current";
import { acceptInvite as accept } from "@/lib/teams/invites";

export type AcceptInviteState = { message: string } | null;

/** 초대 수락. 성공하면 들어간 팀의 설정으로 보낸다. */
export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData
): Promise<AcceptInviteState> {
  const user = await requireUser();

  // 초대 링크로 처음 가입한 사람은 아직 public.users 에 행이 없을 수 있다. 멤버십이
  // 그 행을 참조하므로 먼저 미러한다(개인 팀도 이때 생긴다).
  await syncUser(user);

  const result = await accept(user.id, String(formData.get("token") ?? ""));
  if (!result.ok) return { message: result.message };

  // 들어간 팀을 지금 팀으로. 수락하고 프로젝트 목록으로 가면 그 팀 프로젝트가 보여야 한다.
  await rememberCurrentTeam(result.teamId);
  revalidatePath("/", "layout");
  redirect(`/team/${result.teamId}/settings/general`);
}
