"use server";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { verifyApiKey } from "@/lib/ai/verify-key";
import { requireUser } from "@/lib/auth/user";
import { encryptSecret } from "@/lib/crypto/secret";
import { findAiProvider, isAiProvider } from "@/lib/projects/ai-providers";
import { isTestFramework } from "@/lib/projects/frameworks";

/** 4단계 폼이 화면에 돌려줄 실패 사유. 성공하면 redirect 하므로 반환되지 않는다. */
export type ApiKeyState = { error: string } | null;

/**
 * 온보딩 3단계 — 테스트 러너를 고른다.
 *
 * 고른 값은 Project.testFramework 에 저장한다. 나중에 테스트 코드를 만들 때
 * 이 값으로 파일 이름 규칙(*.test.ts vs __tests__/), import 구문, 설정 파일을
 * 결정하므로 세션이 아니라 DB 에 남아야 한다.
 */
export async function selectFramework(formData: FormData) {
  const user = await requireUser();

  const ref = String(formData.get("projectRef") ?? "");
  const framework = String(formData.get("framework") ?? "");

  // 폼 값은 조작될 수 있다. 아는 값만 통과시킨다.
  if (!isTestFramework(framework)) {
    throw new Error(`Unknown test runner: ${framework}`);
  }

  const project = await requireOwnedProject(ref, user.id);

  await prisma.project.update({
    where: { id: project.id },
    data: { testFramework: framework },
  });

  redirect(`/projects/setup/${ref}/api-key`);
}

/**
 * 온보딩 4단계 — LLM API 키를 넣는다.
 *
 * 키는 프로젝트가 아니라 사용자에게 붙는다(UserApiKey). 레포를 여러 개 연결해도
 * 키를 매번 다시 넣게 하면 짜증나기 때문이다. 그래서 두 번째 프로젝트부터는
 * 이 화면에서 입력란을 비워둔 채 넘어갈 수 있다.
 *
 * useActionState 로 부르므로 첫 인자가 이전 상태다. 성공하면 redirect 하니
 * 반환값은 실패 경로에만 쓰인다.
 */
export async function saveApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const user = await requireUser();

  const ref = String(formData.get("projectRef") ?? "");
  const providerId = String(formData.get("provider") ?? "");
  const key = String(formData.get("apiKey") ?? "").trim();

  if (!isAiProvider(providerId)) {
    return { error: "Pick a provider first." };
  }
  const provider = findAiProvider(providerId);

  const project = await requireOwnedProject(ref, user.id);

  // 비워서 보냈다 = "저장해둔 키 그대로 쓸게". 저장해둔 게 없으면 넘길 수 없다.
  if (!key) {
    const saved = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: user.id, provider: providerId } },
      select: { id: true },
    });
    if (!saved) {
      return { error: `Paste your ${provider.vendor} API key, or skip this step.` };
    }
    return completeSetup(project.id, ref);
  }

  if (!provider.keyPattern.test(key)) {
    return { error: `That is not a ${provider.vendor} key format. ${provider.keyHint}.` };
  }

  // 벤더에 한 번 물어본다. null 은 "우리가 벤더에 못 닿았다"라서 통과시킨다 —
  // 벤더 장애 때문에 가입이 막히는 편보다, 나중에 실패하는 편이 낫다.
  if ((await verifyApiKey(providerId, key)) === false) {
    return {
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
    // 프로바이더당 키 하나. 다시 넣으면 덮어쓴다.
    update: { encryptedKey: encryptSecret(key), lastFour: key.slice(-4) },
  });

  return completeSetup(project.id, ref);
}

/**
 * 키 없이 넘어간다.
 *
 * setupCompletedAt 은 여기서도 찍는다. 안 찍으면 다음 방문마다 온보딩으로 다시
 * 끌려와서 "건너뛰기"가 아무 의미가 없다. 키가 없다는 사실은 나중에 대시보드
 * 배너와 프로젝트 설정에서 알린다.
 */
export async function skipApiKey(formData: FormData) {
  const user = await requireUser();
  const ref = String(formData.get("projectRef") ?? "");

  const project = await requireOwnedProject(ref, user.id);
  await completeSetup(project.id, ref);
}

/** 온보딩 끝 표시 후 대시보드로. redirect 는 throw 라 이 함수는 반환하지 않는다. */
async function completeSetup(projectId: string, ref: string): Promise<never> {
  await prisma.project.update({
    where: { id: projectId },
    data: { setupCompletedAt: new Date() },
  });
  redirect(`/project/${ref}/dashboard`);
}

/** 내 프로젝트가 맞는지 확인 — 권한 검사는 앱 코드에서 (AGENTS.md). */
async function requireOwnedProject(ref: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { ref, userId },
    select: { id: true },
  });
  if (!project) notFound();
  return project;
}
