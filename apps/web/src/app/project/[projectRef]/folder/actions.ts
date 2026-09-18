"use server";

import { refresh } from "next/cache";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { saveGeneratedVersion, saveTestCode } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { componentName } from "@/lib/projects/recommendations";
import { generateTestForFile } from "@/lib/projects/test-generation";

export type GenerateFolderTestResult =
  | { ok: true; code: string; testPath: string }
  | { ok: false; reason: "budget" | "not-found" | "error" };

/**
 * 폴더 보기에서 연 파일의 테스트를 만들어 버전으로 저장하고 코드를 돌려준다.
 * 화면은 여기서 새로 그리지 않는다 — 폴더 보기가 받은 코드를 타이핑하는 연출을 먼저 보여준 뒤
 * router.refresh() 로 저장된 최신 버전을 읽어 Test Code 칸에 띄운다(다시 와서 열어도 남아 있다).
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
  return { ok: true, code: result.code, testPath: result.testPath };
}

type SaveResult = { ok: true } | { ok: false; reason: "not-found" | "invalid" };

/** 본인 프로젝트인지 확인하고 저장한 뒤 화면을 새로 그린다. 규칙은 saveTestCode 에 있다. */
async function save(
  projectRef: string,
  filePath: string,
  code: string,
  source: "ai" | "user"
): Promise<SaveResult> {
  const user = await requireUser();
  const [repo, projectId] = await Promise.all([
    getProjectRepo(projectRef, user.id),
    getOwnedProjectId(projectRef, user.id),
  ]);
  if (!repo || !projectId) notFound();

  const result = await saveTestCode({ repo, projectId, filePath, code, source });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/** AI 채팅 답변의 코드블록을 이 소스 파일의 테스트 새 버전으로 저장한다(Apply). */
export async function applyTestCode(
  projectRef: string,
  filePath: string,
  code: string
): Promise<SaveResult> {
  return save(projectRef, filePath, code, "ai");
}

/**
 * 폴더 보기 수정 모드의 Save. 레포 테스트든 AI 가 만든 테스트든 사용자가 고친 내용을 새 버전으로 쌓는다.
 * source 를 인자로 받지 않는다 — 클라이언트가 "repo" 를 보내면 레포 동기화 규칙이 흐트러진다.
 */
export async function saveTestEdit(
  projectRef: string,
  filePath: string,
  code: string
): Promise<SaveResult> {
  return save(projectRef, filePath, code, "user");
}
