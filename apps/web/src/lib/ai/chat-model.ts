import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { prisma } from "@dante/db";
import { decryptSecret } from "@/lib/crypto/secret";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/projects/ai-providers";

// ⚠️ 서버 전용. 사용자 키를 복호화한다.
//
// ai-providers.ts 는 "어느 회사 키를 쓸지"까지만 정하고 모델 이름은 적지 않는다
// (모델은 몇 달마다 바뀐다). 부르는 쪽에서 정한다 — 그 "한 곳"이 여기다.
const MODELS: Record<AiProviderId, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5.2",
  google: "gemini-3.5-flash",
};

/**
 * 사용자가 저장해둔 키로 만든 채팅 모델. 키가 하나도 없으면 null.
 *
 * 키를 여러 개 넣어둘 수 있으므로 우선순위가 필요하다. 온보딩에서 보여주는
 * 순서(AI_PROVIDERS)를 그대로 쓴다 — 화면과 다른 순서를 또 만들지 않으려고.
 */
export async function userChatModel(userId: string): Promise<LanguageModel | null> {
  const keys = await prisma.userApiKey.findMany({
    where: { userId },
    select: { provider: true, encryptedKey: true },
  });

  for (const { id } of AI_PROVIDERS) {
    const row = keys.find((key) => key.provider === id);
    if (!row) continue;

    const apiKey = decryptSecret(row.encryptedKey);
    // 프로바이더마다 모델 id 타입이 달라서 switch 로 편다 (유니온 호출은 타입이 꼬인다).
    if (id === "anthropic") return createAnthropic({ apiKey })(MODELS.anthropic);
    if (id === "openai") return createOpenAI({ apiKey })(MODELS.openai);
    return createGoogle({ apiKey })(MODELS.google);
  }

  return null;
}
