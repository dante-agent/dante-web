import { Prisma, prisma, type TeamRole } from "@dante/db";

// ⚠️ 서버 전용. 팀 이름·멤버·삭제를 바꾸는 규칙을 한곳에 둔다.
//
// 서버 액션은 폼 값만 풀어서 여기로 넘긴다. 규칙(owner 만 한다, owner 는 한 명 이상
// 남는다, 개인 팀은 지우거나 떠날 수 없다)이 액션마다 흩어지면 한 곳만 빠뜨려도
// 주인 없는 팀이 생긴다.
//
// 모두 Serializable 트랜잭션이다. "owner 가 한 명 이상" 은 여러 행을 보고 판단하는
// 규칙이라, 두 owner 가 동시에 서로를 member 로 내리면 각자 읽은 값으로는 둘 다
// 통과한다. Serializable 이면 둘 중 하나가 P2034 로 실패한다.

export type TeamChangeFailure = { ok: false; message: string };
export type TeamChange = { ok: true } | TeamChangeFailure;

/** 팀 이름 길이 상한. 설정 왼쪽 열과 헤더 드롭다운에 한 줄로 들어가야 한다. */
export const TEAM_NAME_MAX = 48;

const OK: TeamChange = { ok: true };
export const fail = (message: string): TeamChangeFailure => ({ ok: false, message });

// 멤버가 아니면 팀이 있다는 사실도 드러내지 않는다(access.ts 의 notFound 와 같다).
export const NOT_FOUND = fail("Team not found.");
export const OWNER_ONLY = fail("Only team owners can do this.");

type Tx = Prisma.TransactionClient;

/**
 * Serializable 트랜잭션 + 동시 변경 실패를 문구로. 초대(invites.ts)도 같은 규칙으로 쓴다.
 * 성공 값에 필드를 더 실을 수 있게 제네릭이다(초대 수락은 들어간 팀 id 를 돌려준다).
 */
export async function run<T extends { ok: true }>(
  change: (tx: Tx) => Promise<T | TeamChangeFailure>
): Promise<T | TeamChangeFailure> {
  try {
    return await prisma.$transaction(change, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return fail("Someone else changed this team at the same time. Try again.");
    }
    throw error;
  }
}

/** 트랜잭션 안에서 팀과 멤버 전부를 읽는다. 부른 사람이 멤버가 아니면 null. */
export async function load(tx: Tx, teamId: string, actorId: string) {
  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: {
      name: true,
      personalForUserId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  const actor = team?.members.find((member) => member.userId === actorId);
  if (!team || !actor) return null;

  const owners = team.members.filter((member) => member.role === "owner").length;
  return { team, actor, owners };
}

export async function renameTeam(actorId: string, teamId: string, rawName: string) {
  const name = rawName.trim();
  if (!name) return fail("Enter a team name.");
  if (name.length > TEAM_NAME_MAX) {
    return fail(`Team names can be up to ${TEAM_NAME_MAX} characters.`);
  }

  return run(async (tx) => {
    const ctx = await load(tx, teamId, actorId);
    if (!ctx) return NOT_FOUND;
    if (ctx.actor.role !== "owner") return OWNER_ONLY;

    await tx.team.update({ where: { id: teamId }, data: { name } });
    return OK;
  });
}

export async function changeRole(
  actorId: string,
  teamId: string,
  targetId: string,
  role: TeamRole
) {
  return run(async (tx) => {
    const ctx = await load(tx, teamId, actorId);
    if (!ctx) return NOT_FOUND;
    if (ctx.actor.role !== "owner") return OWNER_ONLY;

    const target = ctx.team.members.find((member) => member.userId === targetId);
    if (!target) return fail("That person is not on this team.");
    if (target.role === role) return OK;

    if (role === "member") {
      // 개인 팀의 주인이 member 가 되면, 다른 owner 가 그 사람을 자기 개인 팀에서
      // 내보낼 수 있게 된다. 개인 팀은 계정과 함께 사라지는 팀이라 막는다.
      if (ctx.team.personalForUserId === targetId) {
        return fail("The owner of a personal team stays an owner.");
      }
      if (ctx.owners === 1) return fail("A team needs at least one owner.");
    }

    await tx.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetId } },
      data: { role },
    });
    return OK;
  });
}

export async function removeMember(actorId: string, teamId: string, targetId: string) {
  if (targetId === actorId) return leaveTeam(actorId, teamId);

  return run(async (tx) => {
    const ctx = await load(tx, teamId, actorId);
    if (!ctx) return NOT_FOUND;
    if (ctx.actor.role !== "owner") return OWNER_ONLY;

    if (!ctx.team.members.some((member) => member.userId === targetId)) {
      return fail("That person is not on this team.");
    }
    if (ctx.team.personalForUserId === targetId) {
      return fail("The owner of a personal team can't be removed.");
    }

    // 지우는 사람이 owner 이고 대상이 아니므로, 지워도 owner 는 한 명 이상 남는다.
    await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId: targetId } } });
    return OK;
  });
}

/** 멤버십만 지운다. 프로젝트와 설치는 팀에 남는다. */
export async function leaveTeam(actorId: string, teamId: string) {
  return run(async (tx) => {
    const ctx = await load(tx, teamId, actorId);
    if (!ctx) return NOT_FOUND;

    if (ctx.team.personalForUserId === actorId) {
      return fail("You can't leave your personal team.");
    }
    if (ctx.actor.role === "owner" && ctx.owners === 1) {
      return fail("You're the only owner. Make someone else an owner first, or delete the team.");
    }

    await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId: actorId } } });
    return OK;
  });
}

/**
 * 팀 삭제. 되살리기는 없다.
 *
 * 지우는 건 Team 행 하나다. 멤버십·GitHub 설치·프로젝트와 그 아래 전부는
 * onDelete: Cascade 로 DB 가 같이 지운다. GitHub 쪽 앱 설치는 건드리지 않는다 —
 * 우리에게 지울 권한이 없을 수 있다(프로젝트 삭제와 같다).
 *
 * 개인 팀은 지우지 않는다. "항상 팀이 있다"는 전제가 깨지고, 계정 삭제가 따로 치운다.
 */
export async function deleteTeam(actorId: string, teamId: string, confirmation: string) {
  return run(async (tx) => {
    const ctx = await load(tx, teamId, actorId);
    if (!ctx) return NOT_FOUND;
    if (ctx.actor.role !== "owner") return OWNER_ONLY;
    if (ctx.team.personalForUserId !== null) return fail("Personal teams can't be deleted.");

    // 버튼은 입력이 맞을 때만 눌리지만 그건 화면 사정이다. 서버에서 다시 본다.
    if (confirmation !== ctx.team.name) return fail("That does not match the team name.");

    await tx.team.delete({ where: { id: teamId } });
    return OK;
  });
}
