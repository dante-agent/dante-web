import { Prisma, prisma } from "@dante/db";

// ⚠️ 서버 전용. 가입한 사람마다 개인 팀을 하나 둔다.
//
// "항상 팀이 있다"는 전제는 여기서 만들어진다. public.users 에 행이 생기는 자리
// (syncUser)가 이 함수를 같이 부르므로, 미러된 사용자는 모두 개인 팀을 가진다.

/**
 * 이 사용자의 개인 팀 id. 없으면 만들고 owner 로 넣는다.
 *
 * 로그인마다 불려도 되게 멱등하다. 팀과 멤버십을 중첩 create 한 번으로 만들어서
 * "팀은 있는데 주인이 멤버가 아닌" 상태가 생기지 않는다.
 *
 * 같은 사람의 요청 두 개가 동시에 들어오면 둘 다 "없음"을 보고 create 할 수 있다.
 * personalForUserId 가 unique 라 하나는 P2002 로 실패하는데, 그건 이미 만들어졌다는
 * 뜻이므로 다시 읽어서 돌려준다.
 */
export async function ensurePersonalTeam(userId: string, name: string): Promise<string> {
  const existing = await findPersonalTeamId(userId);
  if (existing) return existing;

  try {
    const team = await prisma.team.create({
      data: {
        name,
        personalForUserId: userId,
        members: { create: { userId, role: "owner" } },
      },
      select: { id: true },
    });
    return team.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await findPersonalTeamId(userId);
      if (raced) return raced;
    }
    throw error;
  }
}

async function findPersonalTeamId(userId: string) {
  const team = await prisma.team.findUnique({
    where: { personalForUserId: userId },
    select: { id: true },
  });
  return team?.id ?? null;
}
