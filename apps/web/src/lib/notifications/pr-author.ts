import { prisma } from "@dante/db";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import type { AuthorCheck, PullRequestAuthor } from "@/lib/notifications/pr-author-rules";

// ⚠️ 서버 전용. PR 작성자가 테스트 생성 비용을 낼 수 있는 사람인지 본다.
// 사유 문구와 규칙은 pr-author-rules.ts.

/**
 * 작성자 → 이 팀의 Dante 사용자 → 이번 달 한도.
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

  try {
    const budget = await getMonthlyBudgetStatus(user.id);
    if (budget.exceeded) return { kind: "budget-exceeded", login: author.login };
  } catch (error) {
    // 설정 누락(AI_MONTHLY_BUDGET_USD)이면 여기로 온다. budget.ts 가 fail closed 인 것과
    // 같은 판단으로, 한도를 모르면 생성하지 않는다.
    console.error("[pr-author] 한도 확인 실패", { userId: user.id, error });
    return { kind: "budget-unavailable", login: author.login };
  }

  return { kind: "ok", userId: user.id };
}
