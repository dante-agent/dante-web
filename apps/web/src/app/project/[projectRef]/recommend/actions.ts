"use server";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import {
  getAiTestRecommendations,
  type AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations } from "@/lib/projects/recommendations";
import { generateTestForFile, type GenerateTestResult } from "@/lib/projects/test-generation";

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

/** 추천 목록에서 사용자가 고른 파일 하나의 테스트 코드를 만든다. */
export async function generateTest(
  projectRef: string,
  filePath: string
): Promise<GenerateTestResult> {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();

  // Server Action 인자는 신뢰할 수 없다. 현재 추천 후보에 있는 경로만 파일 본문을 읽는다.
  const recommendations = await getTestRecommendations(repo);
  if (!recommendations.some((recommendation) => recommendation.filePath === filePath)) {
    return { ok: false, reason: "not-found" };
  }

  const projectId = await getOwnedProjectId(projectRef, user.id);
  return generateTestForFile({ repo, userId: user.id, projectId, filePath });
}
