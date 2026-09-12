import { prisma } from "@dante/db";
import { currentBillingPeriod } from "./billing-period";

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
 * 월 한도를 환경변수(`AI_MONTHLY_BUDGET_USD`)로 둔 이유.
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
 * 이건 어디까지나 임시 방편이다. 근본 해결은 단가표에 없는 모델은 아예 부르지 않는
 * 것인데(배포 시점 점검), 그건 이 PR 범위를 넘는다. pricing.ts 의 `hasRate()` 가
 * 그 용도로 이미 나와 있다.
 * ponytail: 배포 전 점검으로 hasRate(MODEL) 을 강제하면 이 상수는 (1) 만 덮으면 된다.
 */
const UNKNOWN_CALL_COST_USD = 0.05;

export type BudgetStatus = {
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
};

/** 월 한도(USD). 설정이 없거나 숫자가 아니면 던진다 — 조용히 무제한이 되지 않게. */
function monthlyLimitUsd(): number {
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
  return limit;
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
 */
export async function getMonthlyBudgetStatus(userId: string): Promise<BudgetStatus> {
  const limitUsd = monthlyLimitUsd();
  const period = currentBillingPeriod();

  const agg = await prisma.aiUsage.aggregate({
    where: { userId, createdAt: { gte: period.start, lt: period.end } },
    _sum: { costUsd: true },
    _count: { _all: true, costUsd: true },
  });

  const knownUsd = agg._sum.costUsd?.toNumber() ?? 0;
  const unknownCalls = agg._count._all - agg._count.costUsd;
  // Decimal(12,6) 과 같은 자리에서 끊는다 — 화면에 보이는 합계와 판정 기준이 어긋나지 않게.
  const usedUsd = Number((knownUsd + unknownCalls * UNKNOWN_CALL_COST_USD).toFixed(6));

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
    limitUsd,
    usedUsd,
    knownUsd,
    unknownCalls,
    exceeded: usedUsd >= limitUsd,
  };
}

// ── 남아 있는 구멍 (해결한 척하지 않기) ──────────────────────────────────
//
// 1. 경합(race). 검사는 호출 **전**이고 기록은 호출 **후**(onFinish)다. 같은 사용자가
//    요청 N 개를 동시에 보내면 N 개 모두 검사를 통과한 뒤 함께 기록된다. 즉 이 코드가
//    보장하는 건 "한도 이하로 유지"가 아니라 "한도 + 동시에 날아간 호출들의 원가" 까지만
//    이다. 실제로는 채팅 UI 가 한 번에 한 요청만 보내므로(pending 중 전송 막음) 한 사람이
//    탭을 여러 개 열거나 스크립트로 부를 때만 벌어진다.
//
// 2. 단일 호출의 overshoot. 호출 원가는 스트림이 끝나야 확정되므로, 한도에 $0.01 남은
//    사용자가 아주 비싼 한 번의 호출을 끝까지 하는 걸 막지 못한다. 검사 시점에는 그
//    호출이 얼마일지 알 수 없다.
//
// 둘 다 제대로 막으려면 호출 전에 비관적 금액을 "예약"해두고(추정 원가로 행을 먼저 쓰고
// onFinish 에서 실제값으로 갱신) 사용자별 락을 걸어야 한다. 그건 이 PR 범위를 넘고,
// 실패한 예약을 되돌리는 문제(스트림이 끊기면 예약이 남는다)를 새로 만든다.
// 지금 한도는 "청구서 폭주를 막는 상한"으로는 충분하고, "정확히 $N 에서 멈추는 미터"는
// 아니다.
// ponytail: 정확한 차단이 필요해지면 사전 예약 + 사용자별 advisory lock.
