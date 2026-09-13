import { prisma } from "@dante/db";

// ⚠️ 서버 전용. 계정 삭제 규칙(팀 모델 결정 9).
//
//   - 개인 팀은 지운다. 그 팀의 프로젝트·설치는 Cascade 로 같이 사라진다.
//   - 다른 팀에서는 멤버십만 빠진다(TeamMember 가 User 에 Cascade).
//     그 팀 프로젝트·설치에 남은 "만든 사람" 기록은 SetNull 로 비워진다.
//   - 혼자 owner 인 공유 팀이 있으면 막는다. 지우게 두면 주인 없는 팀이 남는다.
//
// 나머지(AI 이용량, 채팅 기록, 익스텐션 토큰)는 사람에게 붙은 데이터라 User 를
// 지우면 Cascade 로 같이 지워진다. 여기서 따로 지우면 스키마가 늘 때마다 목록을
// 같이 고쳐야 한다(프로젝트 삭제와 같은 판단).

export type BlockingTeam = { id: string; name: string };

/** 이 사람이 유일한 owner 인 공유 팀. 하나라도 있으면 계정을 지울 수 없다. */
export async function soleOwnerTeams(userId: string): Promise<BlockingTeam[]> {
  const teams = await prisma.team.findMany({
    where: { personalForUserId: null, members: { some: { userId, role: "owner" } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      members: { where: { role: "owner" }, select: { userId: true } },
    },
  });
  return teams.filter((team) => team.members.length === 1).map(({ id, name }) => ({ id, name }));
}

/**
 * 확인 입력으로 받을 값. 이메일이 있으면 이메일, 없으면 GitHub 핸들.
 * 둘 다 없는 계정은 없다고 보지만(로그인 프로바이더가 둘 중 하나는 준다), 그때는 사용자 id.
 */
export function accountConfirmation(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const handle = user.user_metadata?.user_name;
  return user.email || (typeof handle === "string" && handle) || user.id;
}

/**
 * DB 쪽 정리. auth 사용자를 지운 뒤에 부른다.
 *
 * 개인 팀을 먼저 지운다. Team.personalFor 가 Restrict 라서 사용자 행을 먼저 지우면
 * DB 가 막는다. 두 삭제를 한 트랜잭션에 넣어 개인 팀만 사라지고 사용자가 남는 일이 없게 한다.
 * deleteMany 인 이유: 다른 탭에서 먼저 지웠으면 delete 는 예외를 던진다.
 */
export async function deleteAccountData(userId: string) {
  await prisma.$transaction([
    prisma.team.deleteMany({ where: { personalForUserId: userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);
}
