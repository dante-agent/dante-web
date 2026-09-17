"use server";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { matchFilesToPrompt, MAX_MATCHES } from "@/lib/projects/ai-file-match";
import {
  getAiTestRecommendations,
  type AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import { getGeneratedSessionDetail } from "@/lib/projects/generated-sessions";
import { saveGeneratedVersion } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo, type ProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations, type TestRecommendation } from "@/lib/projects/recommendations";
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
 * generateTest 와 프롬프트 배치 생성(generatePlannedTests)이 함께 쓴다 — 저장 규칙을 한
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

/** 생성 계획에 실을 대상 한 개(경로 + 표시용 이름). */
export type PlanTarget = { filePath: string; componentName: string };

/**
 * planTestGeneration 결과. **생성하지 않고** 확인 다이얼로그에 보여줄 계획만 돌려준다.
 *   matched — AI 가 프롬프트에 맞다고 고른 후보(최대 3, 없을 수 있음)
 *   top     — 우선순위 상위 후보(최대 3). "구체적으로 원하는 게 없음" 폴백용.
 */
export type TestPlanResult =
  | { ok: true; matched: PlanTarget[]; top: PlanTarget[] }
  | { ok: false; reason: "budget" | "error" };

const toTarget = (c: TestRecommendation): PlanTarget => ({
  filePath: c.filePath,
  componentName: c.componentName,
});

/**
 * 상단 입력창 제출 1단계. 자유 문구를 AI 로 후보에 매칭해 **무엇을 생성할지 계획만** 세운다.
 * 실제 생성은 사용자가 다이얼로그에서 확인한 뒤 generatePlannedTests 로 한다 — 한 번에
 * 최대 3개라는 안내와 "관련 파일이 없으면 상위 3개" 선택을 화면이 줄 수 있게.
 */
export async function planTestGeneration(
  projectRef: string,
  userPrompt: string
): Promise<TestPlanResult> {
  const prompt = userPrompt.trim().slice(0, MAX_USER_PROMPT);
  if (!prompt) return { ok: false, reason: "error" };

  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  const projectId = await getOwnedProjectId(projectRef, user.id);

  const candidates = await getTestRecommendations(repo);
  // 후보는 우선순위(높음→낮음)로 정렬돼 있어 앞에서 자르면 상위 N개다.
  const top = candidates.slice(0, MAX_MATCHES).map(toTarget);

  const match = await matchFilesToPrompt({
    userId: user.id,
    projectId,
    userPrompt: prompt,
    candidates,
  });
  if (match.outcome === "budget") return { ok: false, reason: "budget" };
  if (match.outcome === "error") return { ok: false, reason: "error" };

  const byPath = new Map(candidates.map((c) => [c.filePath, c]));
  const matched = match.files
    .map((f) => byPath.get(f))
    .filter((c): c is TestRecommendation => Boolean(c))
    .map(toTarget);
  return { ok: true, matched, top };
}

/**
 * generatePlannedTests 결과.
 *   ok      — versionId 로 세션 상세로 이동. generated = 실제로 만든 파일 수(최대 3).
 *   preview — 생성은 됐지만 소유자가 아니라 저장을 못해 이동할 세션이 없음
 */
export type PromptGenerateResult =
  | { ok: true; versionId: string; generated: number }
  | { ok: false; reason: "budget" | "preview" | "error" };

/**
 * 제출 2단계. 다이얼로그에서 사용자가 확정한 파일들(최대 3)의 테스트를 만들고 버전으로 저장한 뒤,
 * 첫 생성분의 세션 상세로 이동하도록 versionId 를 준다.
 *
 * filePaths 는 클라이언트에서 오므로 믿지 않는다 — 현재 후보에 있는 경로만, 최대 3개로 거른다.
 */
export async function generatePlannedTests(
  projectRef: string,
  filePaths: string[]
): Promise<PromptGenerateResult> {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  const projectId = await getOwnedProjectId(projectRef, user.id);

  const candidates = await getTestRecommendations(repo);
  const byPath = new Map(candidates.map((c) => [c.filePath, c]));
  const targets = [...new Set(filePaths)]
    .map((f) => byPath.get(f))
    .filter((c): c is TestRecommendation => Boolean(c))
    .slice(0, MAX_MATCHES);
  if (targets.length === 0) return { ok: false, reason: "error" };

  let firstVersionId: string | null = null;
  let generated = 0;
  let lastFailure: "budget" | "error" | null = null;

  // 확정 순서대로 생성한다. 하나 실패해도 나머지는 계속 시도한다.
  for (const meta of targets) {
    const result = await generateAndSave({
      repo,
      userId: user.id,
      projectId,
      filePath: meta.filePath,
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

/** 프롬프트에 싣는 실패 로그 상한(글자). 실패 원인은 대개 로그 끝에 있어 뒤에서 자른다. */
const MAX_FAILURE_LOG = 6_000;

export type RegenerateResult =
  | { ok: true; versionId: string }
  | { ok: false; reason: "budget" | "not-found" | "not-failed" | "error" };

/**
 * 세션 상세에서 "Regenerate & retry" 가 부른다. 실패한 버전의 이전 코드 + 실패 로그를 AI 에
 * 넘겨 통과하도록 고친 버전을 만들고 새 TestFileVersion 으로 저장한다(saveGeneratedVersion).
 *
 * 실패한 실행이 있을 때만 돈다 — 통과했거나 실행 전이면 고칠 근거(로그)가 없다.
 * versionId 는 클라이언트에서 오므로 믿지 않고, getGeneratedSessionDetail 이 소유·존재를 거른다.
 */
export async function regenerateFromFailure(
  projectRef: string,
  versionId: string
): Promise<RegenerateResult> {
  const user = await requireUser();
  const detail = await getGeneratedSessionDetail(projectRef, user.id, versionId);
  if (!detail) return { ok: false, reason: "not-found" };

  const run = detail.latestRun;
  if (!run || (run.status !== "failed" && run.status !== "error")) {
    return { ok: false, reason: "not-failed" };
  }

  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  const projectId = await getOwnedProjectId(projectRef, user.id);
  if (!projectId) return { ok: false, reason: "not-found" };

  // 실패 원인은 로그 끝에 있어 뒤에서 자른다. 로그가 없으면 errorMessage 라도 준다.
  const failureLogs = (run.logs ?? run.errorMessage ?? "").slice(-MAX_FAILURE_LOG);
  const result = await generateTestForFile({
    repo,
    userId: user.id,
    projectId,
    filePath: detail.targetFile,
    previousCode: detail.content,
    failureLogs,
  });
  if (!result.ok) return result.reason === "not-found" ? { ok: false, reason: "error" } : result;

  const newVersionId = await saveGeneratedVersion({
    projectId,
    sourceFilePath: result.filePath,
    componentName: detail.componentName,
    testPath: result.testPath,
    code: result.code,
  });
  if (!newVersionId) return { ok: false, reason: "error" };

  return { ok: true, versionId: newVersionId };
}
