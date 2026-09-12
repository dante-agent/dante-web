import { Prisma, prisma } from "@dante/db";

// ⚠️ 서버 전용. 기록해 둔 AI 사용량을 읽어 합계를 낸다.
// 기록은 lib/ai/usage.ts, 토큰 → USD 환산은 lib/ai/pricing.ts.

/**
 * "이번 달"의 경계를 잡는 시간대.
 *
 * 세 가지 후보가 있었다.
 *
 * 1. 서버 UTC — 구현이 가장 쉽지만 한국에서 보면 달이 오전 9시에 바뀐다.
 *    9월 1일 새벽에 부른 호출이 8월 사용량에 붙어서, 사용자가 세어 본 숫자와
 *    화면이 안 맞는다. 같은 이유로 스누즈도 UTC 를 쓰지 않는다
 *    (project/[projectRef]/settings/notifications/actions.ts).
 * 2. 보는 사람의 브라우저 시간대 — 스누즈는 이렇게 한다. 하지만 스누즈는
 *    "이 사람이 지금 누른 버튼"이고, 이쪽은 한도가 걸리는 집계다. 기기마다
 *    경계가 다르면 노트북과 폰에서 합계가 다르게 보이고, "한도가 언제 초기화되나"
 *    에 답이 여러 개가 된다.
 * 3. 고정된 한 시간대 — 초기화 시각이 모든 사용자에게 하나의 순간으로 정해진다.
 *    지표가 흔들리지 않고, 나중에 청구/한도 판정을 서버에서 할 때도 화면과
 *    같은 경계를 쓸 수 있다.
 *
 * 3번을 골랐고, 값은 현재 사용자가 있는 한국으로 둔다. 해외 사용자가 생기면
 * 그 사람 화면의 달 경계는 자기 달력과 최대 반나절 어긋나는데, 합계가 기기마다
 * 달라지는 것보다는 낫다고 봤다. 시간대별 청구가 필요해지면 사용자 설정으로
 * 올려야 하는 값이라 상수로 한 곳에 둔다.
 */
const BILLING_TIME_ZONE = "Asia/Seoul";

/** 벽시계를 읽는 용도. 매 호출마다 만들면 Intl 초기화 비용이 헛되어 모듈 레벨에 둔다. */
const WALL_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: BILLING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "September 2026" — 화면에 그대로 쓰는 구간 이름. */
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: BILLING_TIME_ZONE,
  month: "long",
  year: "numeric",
});

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** 어떤 순간을 BILLING_TIME_ZONE 의 벽시계로 읽은 값. */
function wallClock(at: Date): WallClock {
  const parts = WALL_CLOCK.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * 그 순간 이 시간대가 UTC 와 몇 ms 벌어져 있는지 (한국은 +9시간).
 *
 * 오프셋을 상수(+540분)로 박지 않은 이유: 한국은 서머타임이 없어 지금은 같은
 * 값이 나오지만, BILLING_TIME_ZONE 을 서머타임 있는 지역으로 바꾸는 순간
 * 조용히 한 시간 틀린다. Intl 로 그때그때 물어보면 시간대 이름만 바꿔도 맞는다.
 */
function zoneOffsetMs(at: Date): number {
  const w = wallClock(at);
  // 벽시계 값을 UTC 인 것처럼 다시 조립하면 (현지시각 - UTC) 가 나온다.
  // formatToParts 는 초까지만 주므로 비교 대상도 초 단위로 자른다.
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** 이 시간대의 (year, month) 1일 0시에 해당하는 UTC 순간. */
function monthStart(year: number, month: number, near: Date): Date {
  const wall = Date.UTC(year, month - 1, 1);
  // 오프셋은 시점에 따라 달라질 수 있어(서머타임) 두 번 계산한다. 1차로 근처
  // 시각의 오프셋으로 어림한 뒤, 그 어림값 시점의 오프셋으로 다시 맞춘다.
  const guess = new Date(wall - zoneOffsetMs(near));
  return new Date(wall - zoneOffsetMs(guess));
}

/** 집계 구간. end 는 포함하지 않는다 (`lt`). */
type Period = { start: Date; end: Date; label: string };

function currentMonth(now: Date): Period {
  const w = wallClock(now);
  const next =
    w.month === 12 ? { year: w.year + 1, month: 1 } : { year: w.year, month: w.month + 1 };

  const start = monthStart(w.year, w.month, now);
  return {
    start,
    end: monthStart(next.year, next.month, now),
    label: MONTH_LABEL.format(start),
  };
}

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
  return summarize({ userId }, currentMonth(new Date()));
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
  return summarize({ projectId }, currentMonth(new Date()));
}

async function summarize(scope: Prisma.AiUsageWhereInput, period: Period): Promise<MonthlyAiUsage> {
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
