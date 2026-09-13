// 소스 파일 하나로 테스트 코드를 만든다 (서버 전용).
// 후보 목록을 AI 에 한꺼번에 보내지 않는다. 파일 본문이 토큰을 크게 쓰므로,
// 실제로 "테스트 생성"을 누른 한 파일만 이 함수에 들어온다.
//
// 두 곳이 쓴다. 추천 화면(generateTestForFile)은 기본 브랜치에서 파일을 읽고,
// PR 파이프라인은 PR head 커밋에서 읽은 본문을 generateTestCode 에 바로 넘긴다.

import { generateObject } from "ai";
import { z } from "zod";
import { getMonthlyBudgetStatus, reserveAiBudget } from "@/lib/ai/budget";
import { chatModel, MODEL } from "@/lib/ai/chat-model";
import { maxCostUsd } from "@/lib/ai/pricing";
import { settleAiUsage, usageFromError } from "@/lib/ai/usage";
import { getFileText } from "@/lib/github/blob";
import type { ProjectRepo } from "@/lib/projects/queries";
import { buildTestPrompt, testPathFor } from "@/lib/projects/test-generation-prompt";

/**
 * 출력 토큰 상한(추론 토큰 포함). 예약 금액(원가 상한)을 이 값으로 묶는다 — 이 값에서 출력
 * 원가 상한은 $0.448 이다. 테스트 파일 하나로는 넉넉하지만, 넘으면 JSON 이 잘려 생성이
 * 실패(reason: "error")한다.
 */
const MAX_OUTPUT_TOKENS = 32_000;

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
    // 락 없는 사전 검사. 막힐 요청에 GitHub API 를 태우지 않으려고 파일을 읽기 전에 본다.
    const budget = await getMonthlyBudgetStatus(args.userId);
    if (budget.exceeded) return { ok: false, reason: "budget" };

    const source = await getFileText(args.repo, args.filePath);
    if (source === null) return { ok: false, reason: "not-found" };

    const generated = await generateTestCode({
      userId: args.userId,
      projectId: args.projectId,
      filePath: args.filePath,
      source,
    });
    if (!generated) return { ok: false, reason: "budget" };

    return { ok: true, filePath: args.filePath, ...generated };
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
 * 파일 읽기는 하지 않는다 — 부르는 쪽마다 파일을 읽는 시점(기본 브랜치/PR head)과 한도를 셀
 * 사람이 달라서다. 한도는 호출 직전에 예약으로 판정한다(동시 요청을 실제로 막는 곳). 원가 상한은
 * 소스 본문 크기에 달려 있어 읽은 뒤에야 잡을 수 있다.
 *
 * 한도를 넘었으면 null. AI 호출이 실패하면 예약을 정산하고 던진다.
 */
export async function generateTestCode(args: {
  userId: string;
  projectId: string | null;
  filePath: string;
  source: string;
  /** 넘기면 프롬프트에 러너 지시가 붙는다. 추천 화면은 넘기지 않는다 */
  testFramework?: string | null;
  /** 넘기면 이 패키지만 import 하라는 지시가 붙는다. 추천 화면은 넘기지 않는다 */
  dependencies?: string[] | null;
  /** 만들 테스트 경로. 생략하면 `foo.test.tsx`(testPathFor). PR 은 겹치지 않는 경로를 넘긴다 */
  testPath?: string;
}): Promise<{ testPath: string; code: string } | null> {
  const testPath = args.testPath ?? testPathFor(args.filePath);
  const prompt = buildTestPrompt({
    filePath: args.filePath,
    testPath,
    source: args.source,
    testFramework: args.testFramework,
    dependencies: args.dependencies,
  });
  // 키가 없어 던지면 예약이 남으므로 예약 전에 불러 둔다.
  const model = chatModel();

  const reserved = await reserveAiBudget({
    userId: args.userId,
    projectId: args.projectId,
    surface: "test-generation",
    estimateUsd: maxCostUsd(MODEL, { prompt, maxOutputTokens: MAX_OUTPUT_TOKENS }),
  });
  if (!reserved.ok) return null;
  const { reservation } = reserved;

  try {
    const { object, usage } = await generateObject({
      model,
      schema: generatedTestSchema,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    await settleAiUsage(reservation, usage);
    return { testPath, code: object.code };
  } catch (error) {
    await settleAiUsage(reservation, usageFromError(error));
    throw error;
  }
}
