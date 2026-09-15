"use server";

import { refresh } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getRepoTree } from "@/lib/github/tree";
import { getLatestGeneratedTest, saveGeneratedVersion } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { componentName } from "@/lib/projects/recommendations";
import { generateTestForFile } from "@/lib/projects/test-generation";
import { testPathFor } from "@/lib/projects/test-generation-prompt";

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

/** 한 번에 받는 코드 상한(글자). 테스트 파일 하나로는 넉넉하고, 조작된 요청이 거대한 행을 못 넣게. */
const MAX_APPLY_CODE = 200_000;

/**
 * AI 채팅 답변의 코드블록을 이 소스 파일의 테스트 새 버전으로 저장한다(Apply).
 *
 * code 도 filePath 도 클라이언트가 보낸 값이다. 본인 프로젝트 + 레포 트리에 있는 소스 경로만
 * 받는다 — 없는 경로로 Component 행이 생기지 않게. 내용은 검사하지 않는다(사용자 자신의 draft).
 */
export async function applyTestCode(
  projectRef: string,
  filePath: string,
  code: string
): Promise<{ ok: true } | { ok: false; reason: "not-found" | "invalid" }> {
  const user = await requireUser();
  const [repo, projectId] = await Promise.all([
    getProjectRepo(projectRef, user.id),
    getOwnedProjectId(projectRef, user.id),
  ]);
  if (!repo || !projectId) notFound();

  if (typeof code !== "string" || !code.trim() || code.length > MAX_APPLY_CODE) {
    return { ok: false, reason: "invalid" };
  }
  const entry = (await getRepoTree(repo)).find((e) => e.path === filePath);
  if (!entry) return { ok: false, reason: "not-found" };

  // 경로는 지금 보여주는 테스트의 것을 잇는다. 처음이면 레포 규칙대로.
  const latest = await getLatestGeneratedTest(projectId, filePath);
  await saveGeneratedVersion({
    projectId,
    sourceFilePath: filePath,
    componentName: componentName(filePath),
    testPath: latest?.testPath ?? entry.testPath ?? testPathFor(filePath),
    code,
  });
  refresh();
  return { ok: true };
}
