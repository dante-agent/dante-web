import { prisma } from "@dante/db";
import { DEFAULT_AI_QUALITY, parseAiQuality, type AiQuality } from "./quality";

// ⚠️ 서버 전용. 저장된 생성 품질을 읽는다. 선택지와 effort 매핑은 quality.ts.

/**
 * 이 사용자의 생성 품질 기본값.
 *
 * 모르는 값이면 standard 로 읽는다. 한도(budget.ts)와 달리 fail closed 할 이유가
 * 없다 — 이 값은 무엇을 허용하는지가 아니라 얼마나 공들일지를 정하고, 틀려도 더 싼
 * 쪽으로 틀린다.
 */
export async function getUserAiQuality(userId: string): Promise<AiQuality> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiQuality: true },
  });

  const quality = parseAiQuality(user?.aiQuality);
  if (user && !quality) {
    console.warn("[ai-quality] 모르는 값이라 standard 로 읽음", {
      userId,
      aiQuality: user.aiQuality,
    });
  }
  return quality ?? DEFAULT_AI_QUALITY;
}
