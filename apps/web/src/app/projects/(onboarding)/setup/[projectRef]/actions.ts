"use server";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { isTestFramework } from "@/lib/projects/frameworks";

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

  // 내 프로젝트가 맞는지 확인 — 권한 검사는 앱 코드에서 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref, userId: user.id },
    select: { id: true },
  });
  if (!project) notFound();

  await prisma.project.update({
    where: { id: project.id },
    data: { testFramework: framework },
  });

  // TODO(다음 PR): 4단계(API 키)로 보내고, 거기서 setupCompletedAt 을 찍는다.
  // 그 화면이 생기기 전까지는 대시보드로 보낸다 — setupCompletedAt 이 null 이라
  // 프로젝트 목록에는 "설정 미완료" 로 남는다.
  redirect(`/project/${ref}/dashboard`);
}
