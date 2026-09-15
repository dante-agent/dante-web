"use server";

import { refresh } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { saveGeneratedVersion } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { componentName } from "@/lib/projects/recommendations";
import { generateTestForFile } from "@/lib/projects/test-generation";

export type GenerateFolderTestResult =
  { ok: true } | { ok: false; reason: "budget" | "not-found" | "error" };

/**
 * 폴더 보기에서 연 파일의 테스트를 만들어 버전으로 저장하고 화면을 새로 그린다.
 * 페이지가 저장된 최신 버전을 읽어 Test Code 칸에 보여주므로, 다시 와서 열어도 남아 있다.
 *
 * 추천 액션과 달리 추천 후보인지 거르지 않는다. 경로를 조작해 보내도 본인 프로젝트 레포의
 * 파일만 읽히고(폴더 보기가 이미 보여주는 범위), 없는 경로는 not-found, 비용은 본인 한도에서 빠진다.
 */
export async function generateFolderTest(
  projectRef: string,
  filePath: string
): Promise<GenerateFolderTestResult> {
  const user = await requireUser();
  const [repo, projectId] = await Promise.all([
    getProjectRepo(projectRef, user.id),
    getOwnedProjectId(projectRef, user.id),
  ]);
  if (!repo || !projectId) notFound();

  const result = await generateTestForFile({ repo, userId: user.id, projectId, filePath });
  if (!result.ok) return result;

  await saveGeneratedVersion({
    projectId,
    sourceFilePath: result.filePath,
    componentName: componentName(result.filePath),
    testPath: result.testPath,
    code: result.code,
  });
  refresh();
  return { ok: true };
}
