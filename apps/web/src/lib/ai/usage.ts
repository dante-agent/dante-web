import { NoObjectGeneratedError, type LanguageModelUsage } from "ai";
import { prisma } from "@dante/db";
import { MODEL } from "./chat-model";
import { costUsd } from "./pricing";

// ⚠️ 서버 전용. AI 호출 1건의 사용량을 남긴다.
//
// 행은 호출 전에 budget.ts 의 reserveAiBudget 이 원가 상한으로 먼저 만든다(동시 요청이
// 한도를 함께 뚫지 못하게). 여기서는 호출이 끝난 뒤 그 행을 실제 사용량으로 바꾼다.

/** 어디서 부른 건지. 값이 늘 때 마이그레이션하지 않으려고 문자열로 둔다. */
export type UsageSurface = "chat" | "recommend" | "test-generation";

/** reserveAiBudget 이 만든 예약 행. */
export type AiReservation = { id: string };

/**
 * 예약을 실제 사용량으로 정산한다. usage 를 모르면(호출 실패 등) 토큰·원가를 null 로 남기고,
 * 한도에서는 budget.ts 의 UNKNOWN_CALL_COST_USD 로 센다.
 *
 * 한 번만 바뀐다(settledAt 이 null 인 행만 고친다). 채팅은 onError 와 onFinish 가 둘 다
 * 올 수 있는데, 먼저 온 쪽으로 정해지고 뒤에 온 쪽은 아무것도 하지 않는다.
 *
 * 절대 throw 하지 않는다. 채팅에서는 스트림이 끝난 뒤(onFinish) 불리는데, 그때는 사용자에게
 * 이미 답이 다 나간 뒤다. 기록에 실패했다고 응답을 깨뜨리면 사용자는 멀쩡히 받은 답이
 * 에러로 바뀌는 걸 보게 된다. 실패하면 행이 상한 그대로 남는다(한도가 빡빡해지는 쪽).
 * 대신 서버 로그에 남긴다 — 청구서와 우리 집계가 어긋나면 그 로그가 유일한 단서다.
 */
export async function settleAiUsage(
  reservation: AiReservation,
  usage: LanguageModelUsage | undefined
): Promise<void> {
  const tokens = {
    inputTokens: usage?.inputTokens,
    cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens,
    outputTokens: usage?.outputTokens,
  };

  try {
    await prisma.aiUsage.updateMany({
      where: { id: reservation.id, settledAt: null },
      data: {
        inputTokens: tokens.inputTokens ?? null,
        cachedInputTokens: tokens.cachedInputTokens ?? null,
        outputTokens: tokens.outputTokens ?? null,
        costUsd: costUsd(MODEL, tokens),
        settledAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[ai-usage] 정산 실패", { reservationId: reservation.id, error });
  }
}

/**
 * 실패한 generateObject 호출이 그래도 쓴 사용량. 응답은 받았는데 스키마에 안 맞은 경우만
 * 프로바이더가 토큰을 알려준다. 그 밖의 실패는 모른다(undefined).
 */
export function usageFromError(error: unknown): LanguageModelUsage | undefined {
  return NoObjectGeneratedError.isInstance(error) ? error.usage : undefined;
}
