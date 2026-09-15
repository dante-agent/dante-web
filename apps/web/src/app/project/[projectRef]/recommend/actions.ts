"use server";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import {
  getAiTestRecommendations,
  type AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import { saveGeneratedVersion } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations } from "@/lib/projects/recommendations";
import { generateTestForFile } from "@/lib/projects/test-generation";

/**
 * generateTest 의 결과. 생성 성공분은 버전으로 저장하고 그 id 를 얹어 준다 —
 * 화면이 세션 상세(`/recommend/{versionId}`)로 넘어갈 수 있게. 소유 프로젝트 확인이
 * 안 돼 저장을 건너뛰었으면 versionId 는 null(미리보기만 가능).
 */
export type GenerateTestActionResult =
  | { ok: true; filePath: string; testPath: string; code: string; versionId: string | null }
  | { ok: false; reason: "budget" | "not-found" | "error" };

/**
 * "AI 로 정렬" 버튼이 부른다. 초기 화면은 공짜 휴리스틱으로 뜨고, 이 액션을
 * 누를 때만 AI 를 부른다 — 화면을 열 때마다 과금되지 않게(A 안).
 *
 * projectRef 는 클라이언트에서 오므로 그대로 믿지 않고, 이 사용자 프로젝트인지
 * 여기서 다시 거른다(다른 서버 액션과 같은 규칙).
 */
export async function rerankRecommendations(projectRef: string): Promise<AiRecommendationResult> {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();

  const projectId = await getOwnedProjectId(projectRef, user.id);
  return getAiTestRecommendations({ repo, userId: user.id, projectId });
}

/** 추천 목록에서 사용자가 고른 파일 하나의 테스트 코드를 만들고 버전으로 저장한다. */
export async function generateTest(
  projectRef: string,
  filePath: string
): Promise<GenerateTestActionResult> {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();

  // Server Action 인자는 신뢰할 수 없다. 현재 추천 후보에 있는 경로만 파일 본문을 읽는다.
  const recommendations = await getTestRecommendations(repo);
  const match = recommendations.find((recommendation) => recommendation.filePath === filePath);
  if (!match) {
    return { ok: false, reason: "not-found" };
  }

  const projectId = await getOwnedProjectId(projectRef, user.id);
  const result = await generateTestForFile({ repo, userId: user.id, projectId, filePath });
  if (!result.ok) return result;

  // 생성 성공분을 버전으로 남겨 세션 상세에서 다시 열고 실행할 수 있게 한다.
  // projectId 가 없으면 저장할 곳이 없으니 미리보기(versionId: null)로만 돌려준다.
  const versionId = projectId
    ? await saveGeneratedVersion({
        projectId,
        sourceFilePath: result.filePath,
        componentName: match.componentName,
        testPath: result.testPath,
        code: result.code,
      })
    : null;

  return {
    ok: true,
    filePath: result.filePath,
    testPath: result.testPath,
    code: result.code,
    versionId,
  };
}
