import { prisma } from "@dante/db";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import type { AuthorCheck, Payer, PullRequestAuthor } from "@/lib/notifications/pr-author-rules";

// ⚠️ 서버 전용. 테스트 생성 비용을 낼 사람(PR 작성자·Re-run 요청자)이 낼 수 있는지 본다.
// 사유 문구와 규칙은 pr-author-rules.ts.

/**
 * 비용을 낼 사람을 판정한다. author 는 PR 작성자, requester 는 Re-run 을 누른 사람이다.
 *
 * 작성자(wlrnjs)와 다른 팀원(junye0l)이 체크 Re-run 을 눌렀을 때 요청자 한도로 기록되는 것을
 * 운영에서 확인했다(2026-09-18).
 */
export function checkPayer(
  teamId: string,
  author: PullRequestAuthor | null,
  payer: Payer
): Promise<AuthorCheck> {
  switch (payer.kind) {
    case "author":
      return checkPullRequestAuthor(teamId, author);
    case "github-requester":
      return checkPullRequestAuthor(teamId, payer.account);
    case "dante-requester":
      return checkDanteUser(teamId, payer.userId, payer.login);
  }
}

/**
 * GitHub 계정 → 이 팀의 Dante 사용자 → 이번 달 한도.
 *
 * GitHub 숫자 ID 로만 찾는다. 로그인 핸들은 바꿀 수 있고, 버려진 핸들은 남이 가져갈 수
 * 있다. 핸들로 찾으면 그 사람의 한도가 남의 PR 에 쓰인다.
 *
 * 팀 멤버십까지 본다. 같은 GitHub 계정의 Dante 사용자라도 이 프로젝트의 팀에 없으면
 * 그 사람 한도로 세지 않는다 — 다른 팀 레포에 PR 을 올린 것만으로 한도가 빠지면 안 된다.
 */
export async function checkPullRequestAuthor(
  teamId: string,
  author: PullRequestAuthor | null
): Promise<AuthorCheck> {
  if (!author) return { kind: "unknown" };

  const user = await prisma.user.findFirst({
    where: { githubId: BigInt(author.githubId), teamMemberships: { some: { teamId } } },
    select: { id: true },
  });
  if (!user) return { kind: "not-member", login: author.login };

  return checkBudget(user.id, author.login);
}

/**
 * Dante 화면에서 누른 사용자. 화면이 이미 팀 멤버만 들여보내지만 여기서 한 번 더 본다 —
 * 호출부가 늘어도 비용을 낼 자격 판단이 한곳에 남게.
 */
async function checkDanteUser(teamId: string, userId: string, login: string): Promise<AuthorCheck> {
  const member = await prisma.user.findFirst({
    where: { id: userId, teamMemberships: { some: { teamId } } },
    select: { id: true },
  });
  if (!member) return { kind: "not-member", login };

  return checkBudget(userId, login);
}

async function checkBudget(userId: string, login: string): Promise<AuthorCheck> {
  try {
    const budget = await getMonthlyBudgetStatus(userId);
    if (budget.exceeded) return { kind: "budget-exceeded", login };
  } catch (error) {
    // 설정 누락(AI_MONTHLY_BUDGET_USD)이면 여기로 온다. budget.ts 가 fail closed 인 것과
    // 같은 판단으로, 한도를 모르면 생성하지 않는다.
    console.error("[pr-author] 한도 확인 실패", { userId, error });
    return { kind: "budget-unavailable", login };
  }

  return { kind: "ok", userId };
}
