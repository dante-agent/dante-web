"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_BLOCKED_MESSAGE, isDemoUser } from "@/lib/auth/demo";
import { displayName, requireUser } from "@/lib/auth/user";
import { deleteSlackInstallation } from "@/lib/slack/installation";
import { getTeamRole, isTeamId } from "@/lib/teams/access";
import * as invites from "@/lib/teams/invites";
import * as manage from "@/lib/teams/manage";

// 팀 설정의 서버 액션. 폼 값을 풀고, 규칙은 lib/teams/manage.ts 에 맡긴다.
//
// teamId·userId 는 폼에서 온다. 믿지 않는다 — manage 의 모든 함수가 트랜잭션 안에서
// 부른 사람이 그 팀 멤버인지, owner 인지 다시 본다. 사람은 폼이 아니라 세션에서 읽는다.

/** link: 초대 메일이 실패했을 때 owner 가 직접 전할 초대 링크. 그 외에는 없다. */
export type TeamFormState = { ok: boolean; message: string; link?: string } | null;

const NOT_FOUND: TeamFormState = { ok: false, message: "Team not found." };
const DEMO_STATE: TeamFormState = { ok: false, message: DEMO_BLOCKED_MESSAGE };

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function begin(formData: FormData) {
  const user = await requireUser();
  const teamId = field(formData, "teamId");
  // 데모 계정은 팀을 바꾸지 못한다. teamId 를 비워 모든 액션이 blocked 를 돌려주게 한다.
  if (isDemoUser(user)) return { user, teamId: null, blocked: DEMO_STATE };
  // UUID 모양이 아니면 DB 에 묻지 않는다. Prisma 가 예외를 던져 500 이 된다.
  return { user, teamId: isTeamId(teamId) ? teamId : null, blocked: null };
}

function settle(teamId: string, result: manage.TeamChange, message: string): TeamFormState {
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/team/${teamId}/settings`, "layout");
  return { ok: true, message };
}

export async function renameTeam(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const result = await manage.renameTeam(user.id, teamId, field(formData, "name"));
  return settle(teamId, result, "Saved.");
}

export async function changeMemberRole(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const role = field(formData, "role");
  if (role !== "owner" && role !== "member") return { ok: false, message: "Unknown role." };

  const result = await manage.changeRole(user.id, teamId, field(formData, "userId"), role);
  return settle(teamId, result, "Role changed.");
}

export async function removeMember(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const result = await manage.removeMember(user.id, teamId, field(formData, "userId"));
  return settle(teamId, result, "Removed.");
}

export async function inviteMember(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const actor = { id: user.id, name: displayName(user) };
  const result = await invites.createInvite(actor, teamId, field(formData, "email"));
  if (!result.ok || result.sent) {
    return settle(teamId, result, result.ok ? `Invite sent to ${result.email}.` : "");
  }

  // 초대는 만들어졌고 목록에도 뜬다. 메일만 못 보냈으니 링크를 직접 전하게 한다.
  const state = settle(
    teamId,
    result,
    `Invite created for ${result.email}, but the email couldn't be sent. Copy the link below and send it to them.`
  );
  return state && { ...state, link: result.link ?? undefined };
}

export async function revokeInvite(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  // 초대 id 도 uuid 컬럼이다. 모양이 틀리면 DB 에 묻지 않는다(isTeamId 는 UUID 모양만 본다).
  const inviteId = field(formData, "inviteId");
  if (!isTeamId(inviteId)) return { ok: false, message: "Invite not found." };

  const result = await invites.revokeInvite(user.id, teamId, inviteId);
  return settle(teamId, result, "Revoked.");
}

/** 성공하면 그 팀 설정은 더 볼 수 없으므로 프로젝트 목록으로 보낸다. */
export async function leaveTeam(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const result = await manage.leaveTeam(user.id, teamId);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteTeam(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const result = await manage.deleteTeam(user.id, teamId, field(formData, "confirmation"));
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/projects");
  redirect("/projects");
}

/**
 * Slack 연결 끊기. 팀 설정이라 owner 만 한다(팀 모델 결정 2).
 *
 * 프로젝트마다 고른 채널은 지우지 않는다. 다시 연결하면 그대로 이어서 보낸다 —
 * 같은 워크스페이스를 다시 붙이는 경우가 대부분이라, 채널을 다시 고르게 할 이유가 없다.
 */
export async function disconnectSlack(_prev: TeamFormState, formData: FormData) {
  const { user, teamId, blocked } = await begin(formData);
  if (!teamId) return blocked ?? NOT_FOUND;

  const role = await getTeamRole(teamId, user.id);
  if (!role) return NOT_FOUND;
  if (role !== "owner") return { ok: false, message: "Only owners can disconnect Slack." };

  await deleteSlackInstallation(teamId);
  revalidatePath(`/team/${teamId}/settings/slack`);
  return { ok: true, message: "Disconnected." };
}
