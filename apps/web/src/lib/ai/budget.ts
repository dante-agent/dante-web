import { Prisma, prisma } from "@dante/db";
import { currentBillingPeriod, type BillingPeriod } from "./billing-period";
import { MODEL } from "./chat-model";
import type { AiReservation, UsageSurface } from "./usage";

// ⚠️ 서버 전용. "이 사용자가 이번 달 쓴 원가가 한도를 넘었나"를 판정한다.
//
// BYOK 를 걷어내면서 원가 부담이 사용자 → Dante 로 넘어왔다. 사용량 기록(usage.ts)
// 만으로는 청구서를 막지 못한다 — 기록은 "얼마 나갔는지 나중에 안다"이고, 여기는
// "더 나가기 전에 멈춘다"다.
//
// 한도 단위가 원가(USD)인 이유는 pricing.ts 맨 위에 적어뒀다(토큰 수로 걸면 모델을
// 바꿀 때마다 한도를 다시 잡아야 한다).
//
// 한도 주체가 사용자인 이유: 청구서가 사람 단위로 쌓인다. 프로젝트별로 걸면 레포를
// 여러 개 연결하는 것만으로 한도를 곱절로 쓸 수 있다 — 프로젝트 만들기는 공짜다.

/**
 * 한도는 두 곳에서 온다. 사용자에게 플랜(AiPlan)이 붙어 있으면 플랜 값, 없으면 아래
 * 환경변수가 기본 한도다. 플랜을 둔 이유는 schema.prisma 의 AiPlan 주석에 적었다.
 * 어느 쪽이든 값을 알 수 없으면 막는다(fail closed).
 *
 * 기본 한도를 환경변수(`AI_MONTHLY_BUDGET_USD`)로 둔 이유.
 *
 * 상수로 코드에 박는 안도 괜찮다 — git 에 남아 리뷰를 거치고, 환경마다 어긋날 일이
 * 없다. 그럼에도 환경변수를 고른 건 이 숫자가 "코드"가 아니라 "운영 판단"이기
 * 때문이다. 실제 원가가 보이기 시작하면 몇 번이고 조정하게 되고, 로컬·프리뷰·운영이
 * 같은 값일 이유도 없다(로컬에서 $200 을 태울 일은 없다). 값을 바꿀 때마다 코드
 * 리뷰를 붙이면 정작 급할 때(청구서가 튀는 중) 손이 늦는다.
 *
 * 환경변수의 위험은 하나다: 안 넣으면 조용히 무제한이 된다. 그건 이 파일이 막으려는
 * 바로 그 상황이라 **없으면 막는 쪽(fail closed)** 으로 뒀다. chat-model.ts 가
 * OPENAI_API_KEY 없을 때 바로 던지는 것과 같은 판단이다 — 설정 누락은 사용자가 할 수
 * 있는 일이 없으니 조용히 넘기지 말고 배포한 사람에게 보이게 터뜨린다.
 */
const LIMIT_ENV = "AI_MONTHLY_BUDGET_USD";

/**
 * 원가를 모르는 호출 1건을 얼마로 셀지.
 *
 * `costUsd` 가 null 이 되는 경우는 두 가지다. (1) 프로바이더가 토큰 수를 안 준다
 * (스트림이 중간에 끊기면 실제로 그렇다). (2) MODEL 을 바꿨는데 pricing.ts 의 단가표를
 * 같이 안 고쳤다 — 배포 실수다.
 *
 * 이 건들을 합계에서 빼면 "원가를 모르는 호출은 한도가 안 걸린다"가 된다. (2) 는
 * 사람 실수로 언제든 생기므로 실제로 뚫리는 구멍이다. 그렇다고 null 이 하나라도 있으면
 * 막아버리는 것도 못 쓴다 — (1) 한 번에 그 사용자가 이번 달 내내 잠긴다.
 *
 * 그래서 "모르면 0" 도 "모르면 무한" 도 아니고, 넉넉한 고정값으로 센다. 지금 단가
 * (입력 $1.75/M, 출력 $14/M)에서 파일 컨텍스트를 붙인 평범한 채팅 한 턴은
 * 입력 5k + 출력 0.8k ≈ $0.02 다. 그 2~3배를 잡아뒀다 — 틀리더라도 한도가 느슨해지는
 * 쪽이 아니라 빡빡해지는 쪽으로 틀린다.
 *
 * (2) 는 이제 next.config.ts 가 막는다 — 단가표에 없는 MODEL 이면 빌드와 dev 서버가
 * 뜨지 않는다. 그래서 이 상수가 실제로 덮는 건 (1) 뿐이다.
 */
const UNKNOWN_CALL_COST_USD = 0.05;

export type BudgetStatus = {
  /** 한도를 정한 플랜 이름. null 이면 플랜이 없어 기본 한도(환경변수)를 쓴다. */
  planName: string | null;
  /** 이번 달 한도(USD). */
  limitUsd: number;
  /** 한도 판정에 쓰는 금액 = 원가를 아는 건의 합 + 모르는 건의 추정치. */
  usedUsd: number;
  /** 그중 실제로 계산된 원가. */
  knownUsd: number;
  /** 원가를 모르는 건의 수. 0 이 아니면 단가표가 뒤처졌을 수 있다. */
  unknownCalls: number;
  /** 한도를 넘었나. 넘었으면 새 호출을 막는다(경고만 하고 통과시키지 않는다). */
  exceeded: boolean;
  /** 판정에 쓴 구간. 화면은 리셋 시각을 이 값으로 말한다 — 다시 계산하면 월 경계에서 갈라질 수 있다. */
  period: BillingPeriod;
};

/** 플랜이 없는 사용자의 월 한도(USD). 설정이 없거나 숫자가 아니면 던진다 — 조용히 무제한이 되지 않게. */
function defaultLimitUsd(): Prisma.Decimal {
  const raw = process.env[LIMIT_ENV];
  if (!raw) {
    throw new Error(`${LIMIT_ENV} 가 설정되지 않았습니다. .env.example 참고.`);
  }

  const limit = Number(raw);
  // 0 은 허용한다 — "AI 를 완전히 끈다"는 뜻으로 쓸 수 있어야 한다.
  // 음수·NaN 은 의도를 알 수 없으니 통과시키지 않는다.
  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error(`${LIMIT_ENV} 값이 올바르지 않습니다: ${raw}`);
  }
  return new Prisma.Decimal(raw);
}

/**
 * 이 사용자의 월 한도. 플랜이 있으면 플랜 값, 없으면 환경변수 기본값.
 *
 * 플랜 값이 음수면 던진다. DB 의 CHECK 제약이 막고 있지만, 제약이 빠진 환경에서
 * 음수가 "항상 초과"로 조용히 굳는 것보다 배포한 사람에게 보이는 편이 낫다.
 */
async function monthlyLimit(
  db: Prisma.TransactionClient,
  userId: string
): Promise<{ planName: string | null; limit: Prisma.Decimal }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiPlan: { select: { name: true, monthlyLimitUsd: true } } },
  });

  const plan = user?.aiPlan;
  if (!plan) return { planName: null, limit: defaultLimitUsd() };

  if (plan.monthlyLimitUsd.isNegative()) {
    throw new Error(`AI 플랜 "${plan.name}" 의 한도가 음수입니다: ${plan.monthlyLimitUsd}`);
  }
  return { planName: plan.name, limit: plan.monthlyLimitUsd };
}

/**
 * 이번 달 사용량과 한도 초과 여부.
 *
 * 쿼리 한 번으로 끝낸다. `_count` 에 `_all` 과 `costUsd` 를 같이 물어보면 전체 행 수와
 * costUsd 가 null 이 아닌 행 수를 한 번에 받을 수 있어서, 차이가 곧 "원가를 모르는
 * 건"의 수다. `_sum` 은 null 을 알아서 건너뛴다. AiUsage 의 `[userId, createdAt]`
 * 인덱스가 그대로 쓰인다.
 *
 * 이 함수는 throw 할 수 있다(설정 누락). recordAiUsage() 와 반대다 — 그쪽은 응답이 이미
 * 나간 뒤라 삼켜야 하고, 이쪽은 호출 전이라 막아야 한다.
 *
 * 구간은 billing-period.ts 에서 받는다. 직접 계산하지 않는 이유: 사용량 화면
 * (usage-queries.ts)이 같은 구간을 보여줘야 한다. 예전에 여기는 UTC 월, 화면은
 * Asia/Seoul 월로 각자 계산해서 월초 9시간 동안 "화면에 뜬 합계"와 "차단을 결정한
 * 합계"가 달랐다. 사용자가 왜 막혔는지 설명할 수 없는 상태다.
 *
 * 예약 중인 행(settledAt null)도 합계에 들어간다 — costUsd 에 원가 상한이 들어 있다.
 * 이 값은 화면·사전 검사용이고, 호출을 실제로 통과시키는 판정은 reserveAiBudget 이 한다.
 */
export function getMonthlyBudgetStatus(userId: string): Promise<BudgetStatus> {
  return budgetStatus(prisma, userId);
}

async function budgetStatus(db: Prisma.TransactionClient, userId: string): Promise<BudgetStatus> {
  const period = currentBillingPeriod();

  const [{ planName, limit }, agg] = await Promise.all([
    monthlyLimit(db, userId),
    db.aiUsage.aggregate({
      where: { userId, createdAt: { gte: period.start, lt: period.end } },
      _sum: { costUsd: true },
      _count: { _all: true, costUsd: true },
    }),
  ]);

  const known = agg._sum.costUsd ?? new Prisma.Decimal(0);
  const unknownCalls = agg._count._all - agg._count.costUsd;
  // 넘었는지는 Decimal 로 가린다. 한도와 합계가 둘 다 Decimal(12,6) 이라 반올림이 끼지 않는다.
  const used = known.plus(new Prisma.Decimal(UNKNOWN_CALL_COST_USD).times(unknownCalls));

  if (unknownCalls > 0) {
    // 단가표가 모델을 못 따라간 것이면 여기가 유일한 신호다. 사용자에게 보일 일은
    // 아니지만(그 사람이 고칠 수 없다) 로그에는 남아야 한다.
    console.warn("[ai-budget] 원가를 모르는 호출이 있어 추정치로 셈", {
      userId,
      unknownCalls,
      assumedUsdEach: UNKNOWN_CALL_COST_USD,
    });
  }

  return {
    planName,
    limitUsd: limit.toNumber(),
    usedUsd: used.toNumber(),
    knownUsd: known.toNumber(),
    unknownCalls,
    exceeded: used.gte(limit),
    period,
  };
}

export type ReserveResult =
  { ok: true; reservation: AiReservation } | { ok: false; budget: BudgetStatus };

/**
 * 모델을 부르기 **직전에** 한도를 확인하고, 통과하면 그 호출의 원가 상한을 먼저 기록한다.
 * 호출이 끝나면 usage.ts 의 settleAiUsage 로 실제 사용량으로 바꾼다.
 *
 * 왜 예약인가: 검사는 호출 전, 기록은 호출 후라면 같은 사용자가 요청 10개를 동시에 보낼 때
 * 10개 모두 "아직 $0 썼음"을 보고 통과한다(창 10개 + 스크립트면 쉽게 된다). 상한을 먼저
 * 적어두면 뒤따르는 요청이 앞 요청의 몫을 합계에서 본다.
 *
 * 왜 락인가: 예약만으로는 부족하다. 10개가 거의 같은 순간에 합계를 읽으면 서로의 예약이
 * 적히기 전이라 여전히 다 통과한다. 그래서 "합계 읽기 + 예약 쓰기"를 사용자별 advisory
 * lock 안에서 한 줄로 세운다.
 *   - pg_advisory_xact_lock: Postgres 내장. 트랜잭션이 끝나면 저절로 풀려서 푸는 걸 잊을
 *     수 없다. 키는 userId 해시라 다른 사용자끼리는 서로 기다리지 않는다.
 *   - DB 락이라 서버리스 인스턴스가 여러 개여도 같이 막힌다(메모리 락은 인스턴스마다 따로다).
 *   - 락은 이 짧은 트랜잭션 동안만 잡는다. 모델 호출(수십 초)까지 잡으면 같은 사용자의 다른
 *     탭이 전부 멈추고, pgbouncer 연결(connection_limit=1)을 그동안 붙들게 된다.
 *
 * 한도를 넘었는지는 getMonthlyBudgetStatus 와 같은 기준(합계 ≥ 한도)으로 본다. 그래서 막히는
 * 사용자에게 보이는 숫자와 판정이 어긋나지 않는다. 대가로 한도 직전의 마지막 호출 1건은
 * 통과하고, 초과는 그 1건의 원가 상한까지다(아래 "남아 있는 구멍").
 */
export async function reserveAiBudget(args: {
  userId: string;
  projectId?: string | null;
  surface: UsageSurface;
  /** pricing.ts maxCostUsd 로 계산한 이 호출의 원가 상한. */
  estimateUsd: number;
}): Promise<ReserveResult> {
  return prisma.$transaction(
    async (tx) => {
      // pg_advisory_xact_lock 은 void 를 돌려주는데 $queryRaw 는 void 컬럼을 읽지 못한다.
      // 결과가 필요 없으니 $executeRaw 로 부른다.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${args.userId}, 0))`;

      const budget = await budgetStatus(tx, args.userId);
      if (budget.exceeded) return { ok: false, budget };

      const row = await tx.aiUsage.create({
        data: {
          userId: args.userId,
          projectId: args.projectId ?? null,
          surface: args.surface,
          model: MODEL,
          costUsd: args.estimateUsd,
        },
        select: { id: true },
      });
      return { ok: true, reservation: { id: row.id } };
    },
    // 기본값(연결 대기 2초·실행 5초)은 같은 인스턴스에 요청이 몰려 연결 하나를 줄 서서 쓸 때
    // 모자랄 수 있다. 여기서 실패하면 호출이 에러로 끝나므로 조금 넉넉히 둔다.
    { maxWait: 10_000, timeout: 10_000 }
  );
}

// ── 남아 있는 구멍 (해결한 척하지 않기) ──────────────────────────────────
//
// 1. 마지막 호출 1건의 overshoot. 합계가 한도 바로 아래면 그 호출은 통과하고, 한도를 그 호출의
//    원가 상한만큼 넘을 수 있다. 상한은 호출마다 건 maxOutputTokens 로 묶여 있다.
//    "합계 + 상한 > 한도면 거절"로 바꾸면 없어지지만, 그러면 한도가 남아 있는데 막히는
//    사용자가 생기고 화면 숫자로 이유를 설명할 수 없다.
//
// 2. 정산되지 않는 예약. 호출 도중 서버가 죽으면 행이 상한 그대로 남는다. 한도가 느슨해지는
//    쪽이 아니라 빡빡해지는 쪽으로 틀리고, 다음 달이면 구간에서 빠지므로 치우지 않는다.
// ponytail: 남은 예약이 문제가 되면 created_at 이 오래된 미정산 행을 UNKNOWN_CALL_COST_USD 로 센다.
