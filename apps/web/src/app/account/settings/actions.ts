"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@dante/db";
import { verifyApiKey } from "@/lib/ai/verify-key";
import { requireUser } from "@/lib/auth/user";
import { encryptSecret } from "@/lib/crypto/secret";
import { findAiProvider, isAiProvider } from "@/lib/projects/ai-providers";

/** 폼이 화면에 돌려줄 결과. 어느 프로바이더 줄에 표시할지 함께 담는다. */
export type KeyState = { provider: string; error?: string; saved?: boolean } | null;

const AI_SETTINGS_PATH = "/account/settings/ai";

/**
 * 온보딩이 끝난 뒤 키를 바꾸는 자리.
 *
 * 온보딩 화면(saveApiKey)과 검증·암호화는 같지만 끝이 다르다. 저기는 저장한 뒤
 * 온보딩을 끝내고 대시보드로 보내고, 여기는 제자리에 머문다. 한 함수에 두 흐름을
 * 넣으면 분기가 늘기만 해서 나눠 뒀다.
 *
 * 키는 UserApiKey — 프로젝트가 아니라 사용자에게 붙는다. 그래서 프로젝트 소유
 * 검사를 하지 않는다. 예전에 이 액션이 프로젝트 설정 아래 있을 때는 projectRef
 * 를 받아 소유 검사를 했는데, 검사에 통과하든 말든 고치는 대상은 늘 로그인한
 * 사용자 자신의 키라서 아무것도 지켜주지 않는 검사였다.
 */
export async function updateApiKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await requireUser();

  const providerId = String(formData.get("provider") ?? "");
  const key = String(formData.get("apiKey") ?? "").trim();

  if (!isAiProvider(providerId)) return { provider: providerId, error: "Unknown provider." };
  const provider = findAiProvider(providerId);

  if (!key) return { provider: providerId, error: "Paste a key first." };

  if (!provider.keyPattern.test(key)) {
    return {
      provider: providerId,
      error: `That is not a ${provider.vendor} key format. ${provider.keyHint}.`,
    };
  }

  // 벤더에 못 닿으면(null) 통과시킨다 — 온보딩과 같은 판단.
  if ((await verifyApiKey(providerId, key)) === false) {
    return {
      provider: providerId,
      error: `${provider.vendor} rejected this key. Check that it is active and try again.`,
    };
  }

  await prisma.userApiKey.upsert({
    where: { userId_provider: { userId: user.id, provider: providerId } },
    create: {
      userId: user.id,
      provider: providerId,
      encryptedKey: encryptSecret(key),
      lastFour: key.slice(-4),
    },
    update: { encryptedKey: encryptSecret(key), lastFour: key.slice(-4) },
  });

  revalidatePath(AI_SETTINGS_PATH);
  return { provider: providerId, saved: true };
}

/**
 * 키를 지운다.
 *
 * 이 키를 쓰던 프로젝트가 전부 같이 끊긴다. 화면에서 그 사실을 먼저 알린다.
 */
export async function deleteApiKey(formData: FormData) {
  const user = await requireUser();

  const providerId = String(formData.get("provider") ?? "");
  if (!isAiProvider(providerId)) return;

  // 없는 걸 지우려 해도 조용히 넘어간다(deleteMany). 두 번 눌러도 터지지 않게.
  await prisma.userApiKey.deleteMany({ where: { userId: user.id, provider: providerId } });

  revalidatePath(AI_SETTINGS_PATH);
}
