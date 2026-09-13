// 소스 파일 하나로 테스트 코드를 만든다 (서버 전용).
// 후보 목록을 AI 에 한꺼번에 보내지 않는다. 파일 본문이 토큰을 크게 쓰므로,
// 실제로 "테스트 생성"을 누른 한 파일만 이 함수에 들어온다.
//
// 두 곳이 쓴다. 추천 화면(generateTestForFile)은 기본 브랜치에서 파일을 읽고,
// PR 파이프라인은 PR head 커밋에서 읽은 본문을 generateTestCode 에 바로 넘긴다.

import { generateObject } from "ai";
import { z } from "zod";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import { chatModel } from "@/lib/ai/chat-model";
import { recordAiUsage } from "@/lib/ai/usage";
import { getFileText } from "@/lib/github/blob";
import type { ProjectRepo } from "@/lib/projects/queries";
import { buildTestPrompt, testPathFor } from "@/lib/projects/test-generation-prompt";

const generatedTestSchema = z.object({
  code: z.string().min(1),
});

export type GenerateTestResult =
  | { ok: true; filePath: string; testPath: string; code: string }
  | { ok: false; reason: "budget" | "not-found" | "error" };

export async function generateTestForFile(args: {
  repo: ProjectRepo;
  userId: string;
  projectId: string | null;
  filePath: string;
}): Promise<GenerateTestResult> {
  try {
    const budget = await getMonthlyBudgetStatus(args.userId);
    if (budget.exceeded) return { ok: false, reason: "budget" };

    const source = await getFileText(args.repo, args.filePath);
    if (source === null) return { ok: false, reason: "not-found" };

    const { testPath, code } = await generateTestCode({
      userId: args.userId,
      projectId: args.projectId,
      filePath: args.filePath,
      source,
    });

    return { ok: true, filePath: args.filePath, testPath, code };
  } catch (error) {
    console.error("[test-generation] 테스트 생성 실패", {
      repo: `${args.repo.repoOwner}/${args.repo.repoName}`,
      filePath: args.filePath,
      error,
    });
    return { ok: false, reason: "error" };
  }
}

/**
 * 이미 읽은 소스로 AI 를 한 번 부르고 사용량을 userId 에 남긴다.
 *
 * 한도 검사와 파일 읽기는 하지 않는다 — 부르는 쪽마다 파일을 읽는 시점(기본 브랜치/PR head)과
 * 한도를 셀 사람이 달라서다. AI 호출이 실패하면 던진다.
 */
export async function generateTestCode(args: {
  userId: string;
  projectId: string | null;
  filePath: string;
  source: string;
  /** 넘기면 프롬프트에 러너 지시가 붙는다. 추천 화면은 넘기지 않는다 */
  testFramework?: string | null;
}): Promise<{ testPath: string; code: string }> {
  const testPath = testPathFor(args.filePath);
  const { object, usage } = await generateObject({
    model: chatModel(),
    schema: generatedTestSchema,
    prompt: buildTestPrompt({
      filePath: args.filePath,
      testPath,
      source: args.source,
      testFramework: args.testFramework,
    }),
  });

  await recordAiUsage({
    userId: args.userId,
    projectId: args.projectId,
    surface: "test-generation",
    usage,
  });

  return { testPath, code: object.code };
}
