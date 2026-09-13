"use server";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import {
  getAiTestRecommendations,
  type AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";

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
