// "이번 달"이 언제부터 언제까지인지. 사용량 화면과 한도 판정이 **같은 답**을 봐야 한다.
//
// 이 파일이 따로 있는 이유가 그거다. 처음에는 화면(usage-queries.ts)과 한도
// (budget.ts)가 각자 월 경계를 계산했고, 한쪽은 Asia/Seoul, 한쪽은 UTC 였다. 그러면
// 월초 9시간 동안 화면에 "$12 / $20 썼음"이 뜨는데 차단은 다른 숫자로 결정된다 —
// 사용자가 왜 막혔는지 설명할 수 없는 상태가 된다. 값을 맞춰놓는 것으로는 부족하고
// (한쪽만 고치면 또 갈라진다) 정의가 한 벌이어야 한다.

/**
 * 달 경계를 잡는 시간대.
 *
 * 후보가 셋 있었다.
 *
 * 1. 서버 UTC — 구현이 가장 쉽지만 한국에서 보면 달이 오전 9시에 바뀐다. 9월 1일
 *    새벽에 부른 호출이 8월 사용량에 붙어서, 사용자가 세어 본 숫자와 화면이 안 맞는다.
 *    OpenAI 청구서가 UTC 월로 끊기니 그쪽에 맞추자는 주장도 있었는데, 청구서를
 *    지키는 건 전체 지출 상한이지 사용자별 월 경계가 아니다. 사용자 쿼터가 서울
 *    자정에 초기화돼도 청구서 방어력은 그대로다.
 * 2. 보는 사람의 브라우저 시간대 — 스누즈는 이렇게 한다(notifications/actions.ts).
 *    하지만 스누즈는 "이 사람이 지금 누른 버튼"이고 이쪽은 한도가 걸리는 집계다.
 *    기기마다 경계가 다르면 노트북과 폰에서 합계가 다르게 보이고, "한도가 언제
 *    초기화되나"에 답이 여러 개가 된다.
 * 3. 고정된 한 시간대 — 초기화 시각이 모든 사용자에게 하나의 순간으로 정해진다.
 *
 * 3번을 골랐고 값은 현재 사용자가 있는 한국으로 둔다. 해외 사용자가 생기면 그 사람
 * 화면의 달 경계가 자기 달력과 최대 반나절 어긋나는데, 합계가 기기마다 달라지거나
 * 화면과 차단 기준이 다른 것보다는 낫다고 봤다. 시간대별 청구가 필요해지면 사용자
 * 설정으로 올려야 하는 값이라 상수로 한 곳에만 둔다.
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
 * 오프셋을 상수(+540분)로 박지 않은 이유: 한국은 서머타임이 없어 지금은 같은 값이
 * 나오지만, BILLING_TIME_ZONE 을 서머타임 있는 지역으로 바꾸는 순간 조용히 한 시간
 * 틀린다. Intl 로 그때그때 물어보면 시간대 이름만 바꿔도 맞는다.
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
  // 오프셋은 시점에 따라 달라질 수 있어(서머타임) 두 번 계산한다. 1차로 근처 시각의
  // 오프셋으로 어림한 뒤, 그 어림값 시점의 오프셋으로 다시 맞춘다.
  const guess = new Date(wall - zoneOffsetMs(near));
  return new Date(wall - zoneOffsetMs(guess));
}

/** 집계 구간. end 는 포함하지 않는다 (`lt`). */
export type BillingPeriod = {
  start: Date;
  end: Date;
  /** "September 2026". 문구도 여기서 만들어 화면들이 같은 말을 쓰게 한다. */
  label: string;
};

/**
 * 지금이 속한 달의 집계 구간.
 *
 * 사용량을 보여주는 쪽과 한도를 판정하는 쪽이 모두 이 함수를 부른다. 둘이 다른
 * 구간을 보면 안 되므로 각자 계산하지 말고 반드시 여기를 쓴다.
 */
export function currentBillingPeriod(now: Date = new Date()): BillingPeriod {
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
