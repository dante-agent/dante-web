import type { LanguageModelUsage } from "ai";
import { prisma } from "@dante/db";
import { MODEL } from "./chat-model";
import { costUsd } from "./pricing";

// ⚠️ 서버 전용. AI 호출 1건의 사용량을 남긴다.
//
// 부르는 자리가 여럿이 될 것이라 여기에 모아 둔다. 지금은 채팅 하나뿐이지만,
// 정작 돈이 크게 나갈 곳은 테스트 생성이다(레포 파일을 통째로 읽어 붙인다).
// /api/chat 안에 특수하게 박아두면 그때 같은 코드를 다시 쓰게 된다.

/** 어디서 부른 건지. 값이 늘 때 마이그레이션하지 않으려고 문자열로 둔다. */
export type UsageSurface = "chat";

type RecordArgs = {
  userId: string;
  projectId?: string | null;
  surface: UsageSurface;
  usage: LanguageModelUsage;
};

/**
 * 사용량 1건을 기록한다.
 *
 * 절대 throw 하지 않는다. 이 함수는 스트림이 끝난 뒤(onFinish) 불리는데, 그때는
 * 사용자에게 이미 답이 다 나간 뒤다. 기록에 실패했다고 응답을 깨뜨리면 사용자는
 * 멀쩡히 받은 답이 에러로 바뀌는 걸 보게 된다. 대신 서버 로그에 남긴다 —
 * 청구서와 우리 집계가 어긋나면 그 로그가 유일한 단서다.
 */
export async function recordAiUsage({
  userId,
  projectId,
  surface,
  usage,
}: RecordArgs): Promise<void> {
  const tokens = {
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
    outputTokens: usage.outputTokens,
  };

  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        projectId: projectId ?? null,
        surface,
        model: MODEL,
        inputTokens: tokens.inputTokens ?? null,
        cachedInputTokens: tokens.cachedInputTokens ?? null,
        outputTokens: tokens.outputTokens ?? null,
        costUsd: costUsd(MODEL, tokens),
      },
    });
  } catch (error) {
    console.error("[ai-usage] 기록 실패", { userId, surface, error });
  }
}
