"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { displayName, requireUser } from "@/lib/auth/user";
import { isTeamId } from "@/lib/teams/access";
import * as invites from "@/lib/teams/invites";
import * as manage from "@/lib/teams/manage";

// 팀 설정의 서버 액션. 폼 값을 풀고, 규칙은 lib/teams/manage.ts 에 맡긴다.
//
// teamId·userId 는 폼에서 온다. 믿지 않는다 — manage 의 모든 함수가 트랜잭션 안에서
// 부른 사람이 그 팀 멤버인지, owner 인지 다시 본다. 사람은 폼이 아니라 세션에서 읽는다.

export type TeamFormState = { ok: boolean; message: string } | null;

const NOT_FOUND: TeamFormState = { ok: false, message: "Team not found." };

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function begin(formData: FormData) {
  const user = await requireUser();
  const teamId = field(formData, "teamId");
  // UUID 모양이 아니면 DB 에 묻지 않는다. Prisma 가 예외를 던져 500 이 된다.
  return { user, teamId: isTeamId(teamId) ? teamId : null };
}

function settle(teamId: string, result: manage.TeamChange, message: string): TeamFormState {
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/team/${teamId}/settings`, "layout");
  return { ok: true, message };
}

export async function renameTeam(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  const result = await manage.renameTeam(user.id, teamId, field(formData, "name"));
  return settle(teamId, result, "Saved.");
}

export async function changeMemberRole(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  const role = field(formData, "role");
  if (role !== "owner" && role !== "member") return { ok: false, message: "Unknown role." };

  const result = await manage.changeRole(user.id, teamId, field(formData, "userId"), role);
  return settle(teamId, result, "Role changed.");
}

export async function removeMember(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  const result = await manage.removeMember(user.id, teamId, field(formData, "userId"));
  return settle(teamId, result, "Removed.");
}

export async function inviteMember(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  const actor = { id: user.id, name: displayName(user) };
  const result = await invites.createInvite(actor, teamId, field(formData, "email"));
  return settle(teamId, result, result.ok ? `Invite sent to ${result.email}.` : "");
}

export async function revokeInvite(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  // 초대 id 도 uuid 컬럼이다. 모양이 틀리면 DB 에 묻지 않는다(isTeamId 는 UUID 모양만 본다).
  const inviteId = field(formData, "inviteId");
  if (!isTeamId(inviteId)) return { ok: false, message: "Invite not found." };

  const result = await invites.revokeInvite(user.id, teamId, inviteId);
  return settle(teamId, result, "Revoked.");
}

/** 성공하면 그 팀 설정은 더 볼 수 없으므로 프로젝트 목록으로 보낸다. */
export async function leaveTeam(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  const result = await manage.leaveTeam(user.id, teamId);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteTeam(_prev: TeamFormState, formData: FormData) {
  const { user, teamId } = await begin(formData);
  if (!teamId) return NOT_FOUND;

  const result = await manage.deleteTeam(user.id, teamId, field(formData, "confirmation"));
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/projects");
  redirect("/projects");
}
