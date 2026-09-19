import { prisma } from "@dante/db";
import { DEFAULT_AI_PERSONA, parseAiPersona, type AiPersona } from "./persona";

// ⚠️ 서버 전용. 저장된 채팅 스타일을 읽는다. 선택지와 프롬프트 문구는 persona.ts.

export type AiChatPreferences = { persona: AiPersona; instructions: string | null };

/**
 * 이 사용자의 채팅 스타일.
 *
 * 모르는 프리셋이면 balanced 로 읽는다. 품질(quality-queries.ts)과 같은 이유로 fail closed
 * 할 필요가 없다 — 무엇을 허용하는지가 아니라 어떻게 말할지만 정한다.
 */
export async function getUserAiChatPreferences(userId: string): Promise<AiChatPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiPersona: true, aiInstructions: true },
  });

  const persona = parseAiPersona(user?.aiPersona);
  if (user && !persona) {
    console.warn("[ai-persona] 모르는 값이라 balanced 로 읽음", {
      userId,
      aiPersona: user.aiPersona,
    });
  }
  return { persona: persona ?? DEFAULT_AI_PERSONA, instructions: user?.aiInstructions ?? null };
}
