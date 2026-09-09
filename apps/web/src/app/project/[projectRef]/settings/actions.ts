"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { verifyApiKey } from "@/lib/ai/verify-key";
import { requireUser } from "@/lib/auth/user";
import { encryptSecret } from "@/lib/crypto/secret";
import { findAiProvider, isAiProvider } from "@/lib/projects/ai-providers";

/** 폼이 화면에 돌려줄 결과. 어느 프로바이더 줄에 표시할지 함께 담는다. */
export type KeyState = { provider: string; error?: string; saved?: boolean } | null;

/**
 * 온보딩이 끝난 뒤 키를 바꾸는 자리.
 *
 * 온보딩 화면(saveApiKey)과 검증·암호화는 같지만 끝이 다르다. 저기는 저장한 뒤
 * 온보딩을 끝내고 대시보드로 보내고, 여기는 제자리에 머문다. 한 함수에 두 흐름을
 * 넣으면 분기가 늘기만 해서 나눠 뒀다.
 */
export async function updateApiKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await requireUser();

  const ref = String(formData.get("projectRef") ?? "");
  const providerId = String(formData.get("provider") ?? "");
  const key = String(formData.get("apiKey") ?? "").trim();

  if (!isAiProvider(providerId)) return { provider: providerId, error: "Unknown provider." };
  const provider = findAiProvider(providerId);

  await requireOwnedProject(ref, user.id);

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

  revalidatePath(`/project/${ref}/settings`);
  return { provider: providerId, saved: true };
}

/**
 * 키를 지운다.
 *
 * 프로젝트가 아니라 사용자에게서 지우는 것이라, 이 키를 쓰던 다른 프로젝트도
 * 같이 끊긴다. 화면에서 그 사실을 먼저 알린다.
 */
export async function deleteApiKey(formData: FormData) {
  const user = await requireUser();

  const ref = String(formData.get("projectRef") ?? "");
  const providerId = String(formData.get("provider") ?? "");
  if (!isAiProvider(providerId)) return;

  await requireOwnedProject(ref, user.id);

  // 없는 걸 지우려 해도 조용히 넘어간다(deleteMany). 두 번 눌러도 터지지 않게.
  await prisma.userApiKey.deleteMany({ where: { userId: user.id, provider: providerId } });

  revalidatePath(`/project/${ref}/settings`);
}

/** 권한 검사는 앱 코드에서 (AGENTS.md). */
async function requireOwnedProject(ref: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { ref, userId },
    select: { id: true },
  });
  if (!project) notFound();
  return project;
}
