import { headers } from "next/headers";
import { Resend } from "resend";
import { prisma } from "@dante/db";
import {
  INVITE_TTL_MS,
  MAX_PENDING_INVITES,
  createInviteToken,
  hashInviteToken,
  isExpired,
  isInviteToken,
  normalizeEmail,
} from "@/lib/teams/invite-rules";
import { NOT_FOUND, OWNER_ONLY, fail, load, run } from "@/lib/teams/manage";

// ⚠️ 서버 전용. 팀 초대 보내기·거두기·수락.
//
// manage.ts 와 같은 트랜잭션(run)을 쓴다. 초대를 보내는 사이에 owner 에서 내려가거나
// 팀이 지워지는 경우를 같은 방식으로 막는다.

const INVALID = fail("This invite has expired or was already used.");

/**
 * 초대 보내기. owner 만. 같은 주소로 다시 보내면 토큰과 만료를 새로 갈고 옛 링크는 죽는다.
 *
 * 메일은 트랜잭션이 끝난 뒤에 보낸다. 트랜잭션 안에서 외부 API 를 기다리면 Serializable
 * 잠금을 오래 쥔다.
 *
 * 메일이 실패해도 초대는 남긴다. 대신 링크를 돌려줘서 owner 가 직접 전하게 한다.
 * 지워 버리면 목록에 아무것도 남지 않아 초대를 했는지조차 보이지 않고, 메일 설정이
 * 고쳐질 때까지 팀원을 들일 방법이 없다. "보냈다고 믿는" 문제는 화면 문구가 막는다.
 */
export async function createInvite(
  actor: { id: string; name: string },
  teamId: string,
  rawEmail: string
) {
  const email = normalizeEmail(rawEmail);
  if (!email) return fail("Enter a valid email address.");

  const { token, tokenHash } = createInviteToken();
  const now = new Date();

  const result = await run(async (tx) => {
    const ctx = await load(tx, teamId, actor.id);
    if (!ctx) return NOT_FOUND;
    if (ctx.actor.role !== "owner") return OWNER_ONLY;

    // 받는 주소로 가입한 사람이 이미 멤버면 보내지 않는다. 다른 주소로 가입한 멤버는
    // 알아볼 수 없다 — 그 사람이 수락하면 acceptInvite 가 초대만 치운다.
    const member = await tx.teamMember.findFirst({
      where: { teamId, user: { email: { equals: email, mode: "insensitive" } } },
      select: { userId: true },
    });
    if (member) return fail("They're already on this team.");

    // 죽은 초대는 여기서 치운다. 따로 청소 작업을 두지 않으려고.
    await tx.teamInvite.deleteMany({ where: { teamId, expiresAt: { lte: now } } });
    const pending = await tx.teamInvite.count({ where: { teamId, email: { not: email } } });
    if (pending >= MAX_PENDING_INVITES) {
      return fail(`A team can have up to ${MAX_PENDING_INVITES} open invites. Revoke some first.`);
    }

    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    const invite = await tx.teamInvite.upsert({
      where: { teamId_email: { teamId, email } },
      create: { teamId, email, tokenHash, invitedById: actor.id, expiresAt },
      update: { tokenHash, invitedById: actor.id, expiresAt },
      select: { id: true },
    });
    return { ok: true as const, inviteId: invite.id, teamName: ctx.team.name };
  });
  if (!result.ok) return result;

  const url = await inviteUrl(token);
  const sent = await sendInviteEmail({
    to: email,
    teamName: result.teamName,
    inviterName: actor.name,
    url,
  });

  // 링크는 메일이 실패했을 때만 돌려준다. 성공했으면 받는 사람 메일함에만 있으면 된다.
  return { ok: true as const, email, sent, link: sent ? null : url };
}

/** 초대 거두기. owner 만. 이미 없으면(수락됐거나 다른 탭에서 거뒀으면) 그대로 성공이다. */
export async function revokeInvite(actorId: string, teamId: string, inviteId: string) {
  return run(async (tx) => {
    const ctx = await load(tx, teamId, actorId);
    if (!ctx) return NOT_FOUND;
    if (ctx.actor.role !== "owner") return OWNER_ONLY;

    await tx.teamInvite.deleteMany({ where: { id: inviteId, teamId } });
    return { ok: true as const };
  });
}

/**
 * 수락 화면이 보여줄 초대. 링크가 죽었으면 null.
 *
 * 죽은 이유(만료·사용됨·거둬짐)는 나누지 않는다. 링크를 가진 사람에게 팀의 사정을
 * 더 알려줄 이유가 없다.
 */
export async function findInvite(token: string) {
  if (!isInviteToken(token)) return null;

  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      email: true,
      expiresAt: true,
      team: { select: { id: true, name: true } },
      invitedBy: { select: { githubLogin: true, email: true } },
    },
  });
  if (!invite || isExpired(invite.expiresAt)) return null;

  const inviter = invite.invitedBy;
  return {
    email: invite.email,
    teamId: invite.team.id,
    teamName: invite.team.name,
    inviterName: inviter ? (inviter.githubLogin ?? inviter.email?.split("@")[0] ?? null) : null,
  };
}

/**
 * 수락. 링크를 연 사람이 로그인한 계정으로 member 가 된다. 링크는 여기서 죽는다.
 *
 * 이미 멤버면 역할을 건드리지 않고 초대만 치운다 — owner 가 링크를 다시 눌러 member 로
 * 내려가는 일이 없게.
 */
export async function acceptInvite(userId: string, token: string) {
  if (!isInviteToken(token)) return INVALID;

  return run(async (tx) => {
    const invite = await tx.teamInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: { id: true, teamId: true, expiresAt: true },
    });
    if (!invite || isExpired(invite.expiresAt)) return INVALID;

    const member = await tx.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId } },
      select: { role: true },
    });
    if (!member) {
      await tx.teamMember.create({ data: { teamId: invite.teamId, userId, role: "member" } });
    }

    await tx.teamInvite.delete({ where: { id: invite.id } });
    return { ok: true as const, teamId: invite.teamId };
  });
}

/**
 * 메일에 넣을 절대 주소.
 *
 * NEXT_PUBLIC_APP_URL 이 있으면 그걸 쓴다(notifications/links.ts 와 같은 값). 없으면 지금
 * 요청의 호스트로 만든다 — 초대는 사람이 화면에서 누르는 요청이라 호스트가 있다.
 * 로드밸런서 뒤에서는 원래 호스트가 x-forwarded-host 로 온다(auth/callback 과 같다).
 */
async function inviteUrl(token: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}/invite/${token}`;

  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host");
  const protocol =
    incoming.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${protocol}://${host}/invite/${token}`;
}

async function sendInviteEmail(invite: {
  to: string;
  teamName: string;
  inviterName: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[team-invite] RESEND_API_KEY 가 없다");
    return false;
  }

  const { error } = await new Resend(apiKey).emails.send({
    // 도메인을 붙이기 전까지는 Resend 가 주는 onboarding 주소만 쓸 수 있다(그 주소는
    // Resend 계정 주인에게만 보낸다). feedback.ts 와 같다.
    from:
      process.env.TEAM_INVITE_FROM_EMAIL ??
      process.env.FEEDBACK_FROM_EMAIL ??
      "Dante <onboarding@resend.dev>",
    to: invite.to,
    subject: `${invite.inviterName} invited you to ${invite.teamName} on Dante`,
    text: [
      `${invite.inviterName} invited you to join the team "${invite.teamName}" on Dante.`,
      "",
      `Accept the invite: ${invite.url}`,
      "",
      "The link works once and expires in 7 days. You can accept with any account you sign in with.",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  });

  if (error) {
    console.error("[team-invite] 전송 실패", error);
    return false;
  }
  return true;
}
