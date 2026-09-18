// 사용자 자유 문구를 받아, 테스트 후보 파일 목록에서 관련 파일을 최대 3개 고른다 (서버 전용).
//
// 파일 본문은 넣지 않는다 — 후보의 '경로 목록'만 보내고 AI 는 이름·경로로 고른다
// (ai-recommendations 와 같은 결). 그래서 입력이 리포 크기와 무관하고 토큰이 작다.
//
// 실패·예산초과면 빈 목록을 outcome 과 함께 돌려준다 — 부르는 쪽이 "매칭이 안 된 건지,
// AI 가 못 돈 건지"를 구분해 안내할 수 있게.

import { generateObject } from "ai";
import { z } from "zod";
import { reserveAiBudget } from "@/lib/ai/budget";
import { chatModel, MODEL } from "@/lib/ai/chat-model";
import { maxCostUsd } from "@/lib/ai/pricing";
import { settleAiUsage, usageFromError } from "@/lib/ai/usage";
import type { TestRecommendation } from "./recommendations";

/** 한 번에 생성을 허용하는 최대 파일 수. 무제한 배치 생성(비용 폭주)을 막는 상한. */
export const MAX_MATCHES = 3;

/** 경로 최대 3개면 JSON 은 수백 토큰이면 된다. 예약 금액(원가 상한)을 이 값으로 묶는다. */
const MAX_OUTPUT_TOKENS = 1_000;

const matchSchema = z.object({
  files: z.array(z.string()).max(MAX_MATCHES),
  reasoning: z.string(),
});

/**
 *   matched — AI 가 돌아 후보에서 골랐다(빈 목록이면 "관련 파일 없음")
 *   budget  — 이번 달 예산 초과라 AI 를 건너뛰었다
 *   error   — AI 호출이 실패했다(키·모델 등)
 */
export type FileMatchOutcome = "matched" | "budget" | "error";
/** reasoning — 왜 이 파일들을(또는 왜 아무것도) 골랐는지 1~2문장. 채팅 메시지에 그대로 실린다. */
export type FileMatchResult = { files: string[]; outcome: FileMatchOutcome; reasoning: string };

export async function matchFilesToPrompt(args: {
  userId: string;
  projectId: string | null;
  userPrompt: string;
  candidates: TestRecommendation[];
}): Promise<FileMatchResult> {
  if (args.candidates.length === 0) {
    return { files: [], outcome: "matched", reasoning: "There are no files without tests yet." };
  }

  const prompt = buildMatchPrompt(args.candidates, args.userPrompt);
  const reserved = await reserveAiBudget({
    userId: args.userId,
    projectId: args.projectId,
    surface: "recommend",
    estimateUsd: maxCostUsd(MODEL, { prompt, maxOutputTokens: MAX_OUTPUT_TOKENS }),
  });
  if (!reserved.ok) return { files: [], outcome: "budget", reasoning: "" };
  const { reservation } = reserved;

  try {
    const { object, usage } = await generateObject({
      model: chatModel(),
      schema: matchSchema,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    await settleAiUsage(reservation, usage);
    // AI 가 지어낸(후보에 없는) 경로는 버리고, 중복 제거 후 최대 3개만.
    const allowed = new Set(args.candidates.map((c) => c.filePath));
    const files = [...new Set(object.files)].filter((f) => allowed.has(f)).slice(0, MAX_MATCHES);
    return { files, outcome: "matched", reasoning: object.reasoning.trim() };
  } catch (error) {
    await settleAiUsage(reservation, usageFromError(error));
    console.error("[ai-file-match] 매칭 실패", error);
    return { files: [], outcome: "error", reasoning: "" };
  }
}

function buildMatchPrompt(candidates: TestRecommendation[], userPrompt: string): string {
  const list = candidates.map((c) => `- ${c.filePath}`).join("\n");
  // 사용자 문구는 신뢰할 수 없는 자유 텍스트다. 지시가 아니라 "찾는 대상"으로만 취급하게 인용해
  // 감싸고, 출력은 스키마와 아래 화이트리스트 필터(후보 밖 경로 폐기)로 이미 묶여 있다.
  return [
    `The user wants to generate tests for: "${userPrompt}".`,
    "From the candidate source-file paths below, pick the ones that best match what the user described.",
    `Return at most ${MAX_MATCHES} paths, most relevant first. Only choose paths from the list — never invent one.`,
    "If nothing in the list matches, return an empty list.",
    "Also return a short reasoning (1-2 sentences, plain text, same language as the user's request) explaining why you picked those files, or why nothing matched.",
    "",
    list,
  ].join("\n");
}
