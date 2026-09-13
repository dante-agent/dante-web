"use server";

import { redirect } from "next/navigation";
import { Prisma, prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { accessibleInstallationWhere } from "@/lib/teams/access";
import { githubApp } from "@/lib/github/app";
import { createProjectRef } from "@/lib/projects/ref";

/**
 * 레포 하나를 프로젝트로 만든다.
 *
 * 폼에서 온 값 중 믿는 건 repoId 와 installationId 뿐이고, 이름·기본 브랜치 같은
 * 나머지는 GitHub 에 다시 물어본다 — 폼은 사용자가 조작할 수 있다.
 * 그리고 그 설치가 정말 이 사용자가 멤버인 팀의 것인지 DB 로 먼저 확인한다.
 */
export async function importRepo(formData: FormData) {
  const user = await requireUser();

  const repoId = Number(formData.get("repoId"));
  const installationId = BigInt(String(formData.get("installationId") ?? "0"));

  if (!Number.isSafeInteger(repoId) || repoId <= 0) {
    throw new Error("Invalid repository.");
  }

  // 남의 설치 ID 를 끼워 넣어도 여기서 걸린다.
  const installation = await prisma.githubInstallation.findFirst({
    where: { id: installationId, ...accessibleInstallationWhere(user.id) },
  });
  if (!installation) {
    throw new Error("That GitHub installation is not connected to your account.");
  }

  const octokit = await githubApp().getInstallationOctokit(Number(installationId));
  const { data: repo } = await octokit.request("GET /repositories/{repository_id}", {
    repository_id: repoId,
  });

  const ref = createProjectRef();

  try {
    await prisma.project.create({
      data: {
        ref,
        name: repo.name,
        repoId: BigInt(repo.id),
        repoOwner: repo.owner.login,
        repoName: repo.name,
        defaultBranch: repo.default_branch,
        isPrivate: repo.private,
        userId: user.id,
        // 프로젝트는 레포를 열어준 설치와 같은 팀에 속한다.
        teamId: installation.teamId,
        installationId,
      },
    });
  } catch (error) {
    // 레포는 전역에서 프로젝트 하나다(@@unique([repoId])). 내 팀 프로젝트는 고르기
    // 화면이 이미 막으므로, 여기 오는 건 다른 팀이 먼저 연결했거나 두 탭에서 동시에
    // 누른 경우다. 어느 팀인지는 알려주지 않는다.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/projects/new/github?error=repo_taken");
    }
    throw error;
  }

  // 온보딩 3단계로 이어진다. 대시보드로 바로 보내면 러너·API 키를 못 고른다.
  redirect(`/projects/setup/${ref}/framework`);
}
