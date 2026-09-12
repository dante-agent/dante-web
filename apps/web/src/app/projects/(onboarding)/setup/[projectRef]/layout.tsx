import { notFound, redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";

// setup 단계들의 문지기.
//
// 온보딩을 끝낸 프로젝트로 이 URL 에 다시 들어오면 대시보드로 돌려보낸다.
// 막지 않으면 이런 게 된다:
//   - 완료 직후 브라우저 뒤로가기 → 방금 끝낸 단계가 다시 열린다
//   - 예전 링크·북마크로 진입 → 끝난 온보딩을 또 밟는다
// 끝난 뒤 러너·실행 설정을 바꾸는 건 프로젝트 설정(/project/<ref>/settings)이 맡는다.
//
// 페이지가 아니라 레이아웃에 두는 이유: 단계가 늘어날 때마다 같은 검사를
// 새 페이지에 또 적어야 하는데, 한 번 빠뜨리면 그 단계만 조용히 뚫린다.
// 단계별 선행 조건(예: 러너를 골랐는지)은 레이아웃이 경로를 모르므로
// 각 페이지가 직접 본다.
export default async function SetupLayout({
  children,
  params,
}: LayoutProps<"/projects/setup/[projectRef]">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 내 프로젝트가 맞는지도 여기서 한 번 본다 — 권한 검사는 앱 코드에서 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: { setupCompletedAt: true },
  });
  if (!project) notFound();

  if (project.setupCompletedAt) redirect(`/project/${projectRef}/dashboard`);

  return children;
}
