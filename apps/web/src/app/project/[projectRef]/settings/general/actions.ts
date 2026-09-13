"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere, getTeamRole } from "@/lib/teams/access";

/**
 * 프로젝트 삭제. 되살리기는 없다(hard delete).
 *
 * 지우는 건 Project 행 하나뿐이다. 컴포넌트·테스트·실행 기록·알림 설정·전달 로그·
 * PR surface 는 schema.prisma 의 onDelete: Cascade 로 DB 가 같이 지운다. 여기서
 * 따로 지우면 스키마에 테이블이 늘 때마다 이 목록도 같이 고쳐야 한다.
 *
 * 건드리지 않는 것 둘:
 *   - GithubInstallation. 이 사용자의 마지막 프로젝트여도 남긴다. 설치 하나가
 *     레포 여러 개를 덮고, 조직 설치는 사용자에게 지울 권한이 없을 수 있고,
 *     남겨 두면 같은 레포를 다시 붙일 때 재설치가 필요 없다. 완전히 끊고 싶은
 *     사용자에게는 목록 화면이 GitHub 의 설치 화면을 안내한다.
 *   - GitHub PR 에 이미 남긴 코멘트·체크. 그 PR 의 기록이라 거둬 가지 않는다.
 */
export type DeleteProjectResult = {
  message: string;
};

export async function deleteProject(
  _previous: DeleteProjectResult | null,
  formData: FormData
): Promise<DeleteProjectResult> {
  const user = await requireUser();
  const projectRef = String(formData.get("projectRef") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  // 서버 액션은 UI 를 거치지 않고 POST 로 직접 부를 수 있다. 폼에서 온 ref 를
  // 그대로 믿지 않고 이 사용자 것인지 여기서 다시 거른다.
  //
  // 설치 ID 도 지우기 전에 읽어 둔다. 지우고 나면 이 프로젝트가 어느 설치에
  // 붙어 있었는지 알 길이 없어서, 목록 화면이 GitHub 안내를 띄울 수 없다.
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: { id: true, repoOwner: true, repoName: true, installationId: true, teamId: true },
  });
  if (!project) {
    return { message: "Project not found." };
  }

  // 프로젝트 삭제는 owner 만 한다. member 에게는 이미 프로젝트가 보이므로 "없음"으로
  // 가리지 않고 이유를 말한다.
  const role = await getTeamRole(project.teamId, user.id);
  if (role !== "owner") {
    return { message: "Only team owners can delete a project." };
  }

  // 버튼은 입력이 맞을 때만 눌리지만 그건 화면 사정이다. 같은 이유로 여기서 다시 본다.
  if (confirmation !== `${project.repoOwner}/${project.repoName}`) {
    return { message: "That does not match the repository name." };
  }

  // delete 가 아니라 deleteMany 인 이유: 다른 탭에서 먼저 지웠으면 delete 는 예외를
  // 던진다. 어느 쪽이든 결과는 "없음"이라 그대로 목록으로 보내면 된다.
  // 지우는 순간에도 owner 조건을 다시 건다. 위 확인과 이 사이에 역할이 바뀌었을 수 있다.
  await prisma.project.deleteMany({
    where: { id: project.id, ...accessibleProjectWhere(user.id, "owner") },
  });

  // 설치 ID 만 넘기고 계정 이름·URL 은 넘기지 않는다. 목록 화면이 이 ID 로 DB 를
  // 다시 읽어 그린다 — 쿼리 문자열을 화면에 그대로 찍지 않는다(src/app/page.tsx).
  revalidatePath("/projects");
  redirect(`/projects?deleted=${project.installationId}`);
}
