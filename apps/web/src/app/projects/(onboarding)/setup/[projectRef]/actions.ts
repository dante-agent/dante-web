"use server";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { isTestFramework } from "@/lib/projects/frameworks";

/**
 * 온보딩 3단계 — 테스트 러너를 고른다.
 *
 * 고른 값은 Project.testFramework 에 저장한다. 나중에 테스트 코드를 만들 때
 * 이 값으로 import 구문과 기본 테스트 명령을 결정하므로 세션이 아니라 DB 에 남아야 한다.
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

  redirect(`/projects/setup/${ref}/ai`);
}

/**
 * 온보딩 4단계 — 끝낸다.
 *
 * 예전에는 이 단계에서 API 키를 받아 검증·암호화해서 저장했다. 지금은 엔진이
 * 하나로 고정돼 있고 키도 우리 것이라(lib/ai/chat-model.ts) 사용자에게서 받을
 * 값이 없다. 남은 일은 온보딩을 끝났다고 표시하는 것뿐이다.
 *
 * 실패 경로가 없어서 상태를 돌려주지 않는다 — 남의 프로젝트면 404 고, 그
 * 외에는 늘 성공해서 redirect 로 끝난다. 그래서 useActionState 도 쓰지 않는다.
 */
export async function finishSetup(formData: FormData) {
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

/** 내가 멤버인 팀의 프로젝트가 맞는지 확인 — 권한 검사는 앱 코드에서 (AGENTS.md). */
async function requireOwnedProject(ref: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { ref, ...accessibleProjectWhere(userId) },
    select: { id: true },
  });
  if (!project) notFound();
  return project;
}
