"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { detectRuntimeCommands } from "@/lib/projects/detect-runtime";
import { DEFAULT_TIMEOUT_MS, validateRuntimeInput } from "@/lib/projects/runtime";

// 실행 환경 설정 화면이 부르는 서버 액션.
//
// 폼 값은 전부 문자열로 온다. 여기서 한 번 좁히고 나면 아래(DB → runner)는
// 타입 있는 값만 본다.

export type SaveState = { error?: string; saved?: boolean } | null;

const settingsPath = (ref: string) => `/project/${ref}/settings/runtime`;

/** 프로젝트 소유 검사. 설정은 프로젝트에 붙으므로 매번 확인해야 한다(AGENTS.md). */
async function requireProject(projectRef: string) {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: {
      id: true,
      ref: true,
      testFramework: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
    },
  });

  if (!project) throw new Error("Project not found.");
  return project;
}

export async function saveRuntimeSettings(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const projectRef = String(formData.get("projectRef") ?? "");

  let project;
  try {
    project = await requireProject(projectRef);
  } catch {
    return { error: "Project not found." };
  }

  const installCommand = String(formData.get("installCommand") ?? "").trim();
  const testCommand = String(formData.get("testCommand") ?? "").trim();
  const timeoutMs = Number(formData.get("timeoutMs"));

  // 빈 칸은 "기본값으로 되돌린다" 는 뜻이다. 화면의 placeholder 가 그 기본값을
  // 이미 보여주고 있으므로, 지우고 저장하면 본 대로 돌아간다.
  //
  // 화면이 쓴 것과 같은 기본값이어야 한다 — 그래서 여기서도 레포를 다시 본다.
  // (같은 요청 안이라면 react cache 가 GitHub 왕복을 한 번으로 줄인다.)
  const defaults = await detectRuntimeCommands(project, project.testFramework);
  const resolved = {
    installCommand: installCommand || defaults.install,
    testCommand: testCommand || defaults.test,
    timeoutMs,
  };

  const invalid = validateRuntimeInput(resolved);
  if (invalid) return { error: invalid.message };

  // 기본값과 같으면 null 로 되돌린다. 그래야 나중에 기본값을 바꿨을 때
  // "한 번도 안 건드린 프로젝트"가 새 기본값을 따라온다. 타임아웃도 같은 규칙이다.
  await prisma.project.update({
    where: { id: project.id },
    data: {
      installCommand: resolved.installCommand === defaults.install ? null : resolved.installCommand,
      testCommand: resolved.testCommand === defaults.test ? null : resolved.testCommand,
      testTimeoutMs: resolved.timeoutMs === DEFAULT_TIMEOUT_MS ? null : resolved.timeoutMs,
    },
  });

  revalidatePath(settingsPath(project.ref));
  return { saved: true };
}
