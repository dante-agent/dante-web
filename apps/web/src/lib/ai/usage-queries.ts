import { Prisma, prisma } from "@dante/db";
import { currentBillingPeriod, type BillingPeriod } from "./billing-period";

// ⚠️ 서버 전용. 기록해 둔 AI 사용량을 읽어 합계를 낸다.
// 기록은 lib/ai/usage.ts, 토큰 → USD 환산은 lib/ai/pricing.ts.
//
// "이번 달"의 경계는 여기서 계산하지 않는다 — billing-period.ts 하나만 쓴다.
// 한도 판정(budget.ts)이 같은 구간을 봐야 하고, 양쪽이 각자 계산하면 갈라진다.

export type MonthlyAiUsage = {
  /** [periodStart, periodEnd) — 끝은 포함하지 않는다. */
  periodStart: Date;
  periodEnd: Date;
  /** "September 2026". 화면 문구를 여기서 만들어 두 화면이 같은 말을 쓰게 한다. */
  periodLabel: string;
  /** 호출 건수. 원가·토큰을 모르는 건까지 전부 센다. */
  calls: number;
  /**
   * 원가를 아는 건들의 합(USD). unknownCostCalls 가 0 이 아니면 이 값은
   * 실제 지출의 하한이다 — 화면에서 그 사실을 같이 말해야 한다.
   */
  costUsd: number;
  /** 입력 + 출력 토큰. */
  tokens: number;
  /** costUsd 가 null 인 건수 (단가를 모르는 모델 등). */
  unknownCostCalls: number;
  /** 입력이나 출력 토큰 수를 프로바이더가 안 준 건수. */
  unknownTokenCalls: number;
};

/**
 * 이 사용자의 이번 달 합계.
 *
 * 사용자 단위인 이유는 AiUsage.userId 주석과 같다 — 레포를 몇 개 붙이든
 * 청구서에 맞닿는 건 한 사람이 쓴 총량이다.
 */
export function getMonthlyUserAiUsage(userId: string): Promise<MonthlyAiUsage> {
  return summarize({ userId }, currentBillingPeriod());
}

/**
 * 이 프로젝트의 이번 달 합계.
 *
 * userId 로 한 번 더 좁히지 않는다. 부르는 쪽이 이미 소유를 확인했고
 * (getOwnedProjectId), 프로젝트 화면이 답해야 하는 질문은 "이 프로젝트에
 * 얼마가 들었나"다. 팀 모델이 들어오면 팀원이 쓴 몫도 여기 포함돼야 맞는데,
 * userId 를 끼워 두면 그때 조용히 "내가 쓴 몫"만 보여주게 된다.
 */
export function getMonthlyProjectAiUsage(projectId: string): Promise<MonthlyAiUsage> {
  return summarize({ projectId }, currentBillingPeriod());
}

async function summarize(
  scope: Prisma.AiUsageWhereInput,
  period: BillingPeriod
): Promise<MonthlyAiUsage> {
  const where: Prisma.AiUsageWhereInput = {
    ...scope,
    createdAt: { gte: period.start, lt: period.end },
  };

  const [totals, unknownTokenCalls] = await Promise.all([
    prisma.aiUsage.aggregate({
      where,
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      // _count 에 컬럼을 주면 "그 컬럼이 null 이 아닌 행"을 센다. _all 과의 차이가
      // 곧 "원가를 모르는 건수"라, 그것만 세는 왕복을 따로 하지 않아도 된다.
      _count: { _all: true, costUsd: true },
    }),
    // 토큰 쪽은 같은 방법이 안 통한다. 입력만 없는 행과 출력만 없는 행이
    // 따로 있을 수 있어 두 컬럼의 non-null 개수로는 합집합을 구할 수 없다.
    prisma.aiUsage.count({
      where: { ...where, OR: [{ inputTokens: null }, { outputTokens: null }] },
    }),
  ]);

  const { _sum: sum, _count: count } = totals;

  return {
    periodStart: period.start,
    periodEnd: period.end,
    periodLabel: period.label,
    calls: count._all,
    // Decimal → number. 한 달 지출은 달러 단위라 double 로 표현해도 화면에서
    // 틀릴 만큼 오차가 나지 않는다. 다만 한도 판정처럼 "넘었는지"를 가리는
    // 계산은 여기서 나온 number 가 아니라 Decimal 로 해야 한다.
    costUsd: sum.costUsd?.toNumber() ?? 0,
    // cachedInputTokens 는 더하지 않는다. inputTokens 가 캐시분을 포함한
    // 총량이라(lib/ai/pricing.ts 의 TokenCounts) 더하면 두 번 세게 된다.
    tokens: (sum.inputTokens ?? 0) + (sum.outputTokens ?? 0),
    unknownCostCalls: count._all - count.costUsd,
    unknownTokenCalls,
  };
}
