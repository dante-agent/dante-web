"use server";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { matchFilesToPrompt } from "@/lib/projects/ai-file-match";
import {
  getAiTestRecommendations,
  type AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import { saveGeneratedVersion } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo, type ProjectRepo } from "@/lib/projects/queries";
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
  if (!match) return { ok: false, reason: "not-found" };

  const projectId = await getOwnedProjectId(projectRef, user.id);
  return generateAndSave({
    repo,
    userId: user.id,
    projectId,
    filePath,
    componentName: match.componentName,
  });
}

/**
 * 파일 하나를 생성(generateTestForFile)하고 성공분을 버전으로 저장(saveGeneratedVersion)한다.
 * generateTest 와 프롬프트 배치 생성(generateTestsFromPrompt)이 함께 쓴다 — 저장 규칙을 한
 * 곳에 둔다. projectId 가 없으면(소유자 아님) 저장을 건너뛰고 versionId: null(미리보기만).
 */
async function generateAndSave(args: {
  repo: ProjectRepo;
  userId: string;
  projectId: string | null;
  filePath: string;
  componentName: string;
}): Promise<GenerateTestActionResult> {
  const result = await generateTestForFile({
    repo: args.repo,
    userId: args.userId,
    projectId: args.projectId,
    filePath: args.filePath,
  });
  if (!result.ok) return result;

  const versionId = args.projectId
    ? await saveGeneratedVersion({
        projectId: args.projectId,
        sourceFilePath: result.filePath,
        componentName: args.componentName,
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

/** 상단 프롬프트 자유 문구 상한. AI 매칭 프롬프트에 그대로 실리므로 토큰·악용을 막으려 자른다. */
const MAX_USER_PROMPT = 200;

/**
 * PromptInput 제출 결과.
 *   ok       — versionId 로 세션 상세로 이동한다. generated = 실제로 만든 파일 수(최대 3).
 *   no-match — AI 가 후보에서 관련 파일을 찾지 못함
 *   preview  — 생성은 됐지만 소유자가 아니라 저장을 못해 이동할 세션이 없음
 */
export type PromptGenerateResult =
  | { ok: true; versionId: string; generated: number }
  | { ok: false; reason: "budget" | "no-match" | "preview" | "error" };

/**
 * 상단 입력창이 부른다. 자유 문구를 AI 로 후보 파일에 매칭(최대 3개)해 각각 테스트를 만들고
 * 버전으로 저장한 뒤, 첫 생성분의 세션 상세로 이동하도록 versionId 를 준다.
 *
 * generateTest 와 같은 규칙: projectRef 를 여기서 다시 거르고, 후보 목록 안의 경로만
 * 생성한다(매칭이 후보에서만 고르므로 자연히 보장된다).
 */
export async function generateTestsFromPrompt(
  projectRef: string,
  userPrompt: string
): Promise<PromptGenerateResult> {
  const prompt = userPrompt.trim().slice(0, MAX_USER_PROMPT);
  if (!prompt) return { ok: false, reason: "no-match" };

  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  const projectId = await getOwnedProjectId(projectRef, user.id);

  const candidates = await getTestRecommendations(repo);
  const match = await matchFilesToPrompt({
    userId: user.id,
    projectId,
    userPrompt: prompt,
    candidates,
  });
  if (match.outcome === "budget") return { ok: false, reason: "budget" };
  if (match.outcome === "error") return { ok: false, reason: "error" };
  if (match.files.length === 0) return { ok: false, reason: "no-match" };

  const byPath = new Map(candidates.map((c) => [c.filePath, c]));
  let firstVersionId: string | null = null;
  let generated = 0;
  let lastFailure: "budget" | "error" | null = null;

  // 관련도 높은 순으로 생성한다. 하나 실패해도 나머지는 계속 시도한다.
  for (const filePath of match.files) {
    const meta = byPath.get(filePath);
    if (!meta) continue;
    const result = await generateAndSave({
      repo,
      userId: user.id,
      projectId,
      filePath,
      componentName: meta.componentName,
    });
    if (!result.ok) {
      if (result.reason !== "not-found") lastFailure = result.reason;
      continue;
    }
    generated += 1;
    if (result.versionId && !firstVersionId) firstVersionId = result.versionId;
  }

  if (firstVersionId) return { ok: true, versionId: firstVersionId, generated };
  if (generated > 0) return { ok: false, reason: "preview" }; // 만들었지만 저장 못함(소유자 아님)
  return { ok: false, reason: lastFailure === "budget" ? "budget" : "error" };
}
