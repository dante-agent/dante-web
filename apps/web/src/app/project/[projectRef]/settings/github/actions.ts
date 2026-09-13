"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { invalidateRepoLookups } from "@/lib/github/lookup-cache";
import { listInstallationRepos } from "@/lib/github/repos";

/**
 * "지금 다시 확인해줘".
 *
 * DB 의 `disconnectedAt`/`suspendedAt` 은 웹훅이 적어준 값인데, 웹훅은 배달이
 * 늦거나 빠질 수 있다(lib/github/connection.ts 주석). 그래서 화면이 "끊김"이라고
 * 말하는 순간에도 실제로는 이미 고쳐져 있을 수 있다 — 사용자가 방금 GitHub 에서
 * 레포를 다시 열어주고 돌아온 경우가 그렇다. 새로고침으로는 안 풀린다.
 *
 * 진실은 하나뿐이다: GitHub 이 이 설치 토큰으로 그 레포를 보여주느냐. 그래서
 * 여기서는 DB 를 다시 읽지 않고 GitHub 에 직접 물어본 뒤 DB 를 그 답에 맞춘다.
 *
 * 페이지를 열 때마다 자동으로 하지 않는 이유는 왕복 비용이다. 정상인 사용자가
 * 설정 화면을 열 때마다 GitHub API 를 때릴 이유가 없다 — 고친 직후 한 번만
 * 필요한 동작이라 버튼으로 둔다.
 */
export type RecheckResult = {
  /** 지금 연결되어 있나. 버튼 옆 문구의 톤을 정한다. */
  ok: boolean;
  message: string;
};

export async function recheckConnection(
  _previous: RecheckResult | null,
  formData: FormData
): Promise<RecheckResult> {
  const user = await requireUser();
  const projectRef = String(formData.get("projectRef") ?? "");

  // 서버 액션은 UI 를 거치지 않고 POST 로 직접 부를 수 있다. 폼에서 온 ref 를
  // 그대로 믿지 않고 이 사용자 것인지 여기서 다시 거른다.
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: { id: true, repoId: true, installationId: true },
  });
  if (!project) {
    return { ok: false, message: "Project not found." };
  }

  // 연결 상태가 바뀌었을 수 있으니, 끊기기 전에 캐시해 둔 GitHub 조회 결과
  // (runtime 기본값·required check)도 버리고 다음에 새로 받게 한다.
  invalidateRepoLookups(projectRef);

  let repos;
  try {
    repos = await listInstallationRepos(Number(project.installationId));
  } catch (error) {
    return recordFailure(error, project.installationId, projectRef);
  }

  const shared = repos.some((repo) => BigInt(repo.id) === project.repoId);

  if (shared) {
    await prisma.project.updateMany({
      where: { id: project.id },
      data: { disconnectedAt: null, disconnectedReason: null },
    });

    // 토큰이 나왔다는 건 설치가 정지 상태가 아니라는 뜻이다(정지된 설치에는
    // GitHub 이 토큰을 내주지 않는다). 웹훅의 unsuspend 를 놓쳤을 수 있으니
    // 여기서 같이 지운다. deletedAt 은 건드리지 않는다 — 지웠다 다시 설치하면
    // GitHub 이 설치 ID 를 새로 발급하므로 이 행이 되살아나는 일은 없다.
    await prisma.githubInstallation.updateMany({
      where: { id: project.installationId, suspendedAt: { not: null } },
      data: { suspendedAt: null },
    });

    revalidatePath(path(projectRef));
    return { ok: true, message: "Reconnected." };
  }

  // 이미 끊긴 것으로 적혀 있으면 시각을 새로 쓰지 않는다. 버튼을 누를 때마다
  // "언제부터 끊겼나"가 지금으로 밀리고, repo_deleted 였던 사유도 덮인다.
  await prisma.project.updateMany({
    where: { id: project.id, disconnectedAt: null },
    data: { disconnectedAt: new Date(), disconnectedReason: "repo_removed" },
  });

  revalidatePath(path(projectRef));
  return { ok: false, message: "Still not shared with the App." };
}

/**
 * 토큰 발급·목록 조회가 실패한 경우. 실패 코드가 곧 상태다.
 *
 *   401/404  설치가 없다 → 앱이 지워졌다
 *   403      설치는 있는데 GitHub 이 막았다 → 정지
 *
 * 나머지(네트워크·5xx)는 GitHub 쪽 사정이라 DB 를 건드리지 않는다. 여기서
 * "끊김"으로 적으면 잠깐의 장애가 영구 표시로 남는다.
 */
async function recordFailure(error: unknown, installationId: bigint, projectRef: string) {
  const status = httpStatus(error);

  if (status === 401 || status === 404) {
    await prisma.githubInstallation.updateMany({
      where: { id: installationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    revalidatePath(path(projectRef));
    return { ok: false, message: "The App is no longer installed on GitHub." };
  }

  if (status === 403) {
    await prisma.githubInstallation.updateMany({
      where: { id: installationId, suspendedAt: null },
      data: { suspendedAt: new Date() },
    });
    revalidatePath(path(projectRef));
    return { ok: false, message: "GitHub still has this installation suspended." };
  }

  return { ok: false, message: "Could not reach GitHub. Try again in a moment." };
}

/** Octokit 이 던지는 RequestError 의 status. 다른 예외면 null. */
function httpStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = (error as { status: unknown }).status;
  return typeof status === "number" ? status : null;
}

const path = (projectRef: string) => `/project/${projectRef}/settings/github`;
