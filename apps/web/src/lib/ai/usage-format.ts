import type { MonthlyAiUsage } from "./usage-queries";

// 사용량 합계를 화면 문구로 바꾼다.
//
// 조회(usage-queries.ts)에서 분리한 이유: 설정 화면과 프로젝트 대시보드가 같은
// 숫자를 서로 다른 모양으로 그리는데, 문구 규칙까지 각자 갖게 하면 한쪽만
// "$0.00" 이라고 말하는 상황이 생긴다. 여기 있는 규칙은 전부 "모른다(null)를
// 0 으로 말하지 않는다"를 지키기 위한 것이다.
//
// 조회 모듈은 prisma 를 끌고 오지만 이 import 는 타입만이라 런타임에는 남지 않는다.

/** 1이면 단수. "1 calls" 같은 문구를 막으려고 둔다. */
function plural(count: number, word: string): string {
  return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * 이번 달 원가.
 *
 * 한 건도 원가를 모를 때 "$0.00" 을 내면 "공짜로 썼다"로 읽힌다. 그 경우는
 * 금액이 아니라 모른다고 말한다. 일부만 모를 때는 합계를 보여주고 아래
 * usageCaveat 가 "이게 하한이다"를 덧붙인다.
 */
export function formatUsageCost(usage: MonthlyAiUsage): string {
  if (usage.calls > 0 && usage.unknownCostCalls === usage.calls) return "Unknown";
  return formatUsd(usage.costUsd);
}

/**
 * 달러 금액. 사용량과 한도가 같은 규칙으로 찍혀야 "$0.00 / $5.00" 옆에 "$0.0031"
 * 같은 어긋난 모양이 나오지 않는다.
 */
export function formatUsd(usd: number): string {
  // 한 번 부르고 $0.003 인 일이 흔하다. 소수 두 자리에서 자르면 쓴 기록이
  // 있는데도 $0.00 이 되어 0 과 구분이 안 된다 — 1센트 미만은 자릿수를 늘린다.
  const digits = usd > 0 && usd < 0.01 ? 4 : 2;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** 이번 달 토큰 수. 전부 못 받았으면 0 이 아니라 모른다고 말한다. */
export function formatUsageTokens(usage: MonthlyAiUsage): string {
  if (usage.calls > 0 && usage.unknownTokenCalls === usage.calls) return "Not reported";
  return usage.tokens.toLocaleString("en-US");
}

export function formatUsageCalls(usage: MonthlyAiUsage): string {
  return usage.calls.toLocaleString("en-US");
}

/**
 * 합계를 그대로 믿으면 안 되는 이유. 믿어도 되면 null.
 *
 * 숫자만 크게 띄우고 빠진 건을 말하지 않으면, 나중에 청구서와 어긋났을 때
 * 화면이 거짓말을 한 셈이 된다. 반대로 빠진 게 없을 때까지 경고를 달면
 * 그 문구를 아무도 읽지 않게 된다 — 그래서 있을 때만 낸다.
 */
export function usageCaveat(usage: MonthlyAiUsage): string | null {
  const notes: string[] = [];

  if (usage.unknownCostCalls > 0) {
    notes.push(
      `${plural(usage.unknownCostCalls, "call")} of ${usage.calls} ran on a model with no price on file, so the cost above is a floor, not the full amount.`
    );
  }

  if (usage.unknownTokenCalls > 0) {
    notes.push(`${plural(usage.unknownTokenCalls, "call")} came back without token counts.`);
  }

  return notes.length > 0 ? notes.join(" ") : null;
}
