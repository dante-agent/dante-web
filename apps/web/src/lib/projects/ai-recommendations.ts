// 점수로 추린 후보(getTestRecommendations)를 AI 로 다시 우선순위 매긴다 (서버 전용).
//
// 토큰이 커지는 건 '파일 본문'을 넣을 때뿐이다. 여기서는 본문을 넣지 않는다 —
// 후보 30개의 경로와 점수 사유(분기·피참조 수 같은 코드 신호)만 보낸다.
// 그래서 입력이 리포 크기와 무관하다(파일이 1만 개여도 후보 30개만 본다).
//
// 실패하거나 예산을 넘겼으면 후보(점수 결과)를 그대로 돌려준다 — 버튼을 눌러도
// 화면이 비지 않고, 최소한 점수 기준 정렬은 유지된다.

import { generateObject } from "ai";
import { z } from "zod";
import { reserveAiBudget } from "@/lib/ai/budget";
import { chatModel, MODEL } from "@/lib/ai/chat-model";
import { maxCostUsd } from "@/lib/ai/pricing";
import { settleAiUsage, usageFromError } from "@/lib/ai/usage";
import type { ProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations, type TestRecommendation } from "./recommendations";

/**
 * 출력 토큰 상한(추론 토큰 포함). 후보 30개에 한 줄 사유씩이라 JSON 은 수천 토큰이면 된다.
 * 예약 금액(원가 상한)을 이 값으로 묶는다.
 */
const MAX_OUTPUT_TOKENS = 8_000;

const rankingSchema = z.object({
  items: z.array(
    z.object({
      filePath: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      reason: z.string().max(120),
    })
  ),
});

const PRIORITY_ORDER: Record<TestRecommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * AI 정렬이 실제로 무슨 일을 했는지. 목록만 돌려주면 화면이 "AI 가 돌았는지, 조용히
 * 폴백했는지"를 구분할 수 없어서 실패를 안내할 방법이 없다. 그래서 결과에 함께 싣는다.
 *   ranked — AI 가 다시 매겼다
 *   budget — 이번 달 예산 초과라 AI 를 건너뛰고 점수 결과를 그대로 줬다
 *   error  — AI 호출이 실패해(키·모델 등) 점수 결과로 폴백했다
 */
export type RecommendationOutcome = "ranked" | "budget" | "error";

export type AiRecommendationResult = {
  recommendations: TestRecommendation[];
  outcome: RecommendationOutcome;
};

export async function getAiTestRecommendations(args: {
  repo: ProjectRepo;
  userId: string;
  projectId: string | null;
}): Promise<AiRecommendationResult> {
  // 1단계: 점수로 후보 30개까지 컷 (GitHub API 만, AI 토큰 0). 겸 폴백.
  const candidates = await getTestRecommendations(args.repo);
  if (candidates.length === 0) return { recommendations: [], outcome: "ranked" };

  // 이번 달 예산을 넘겼으면 AI 를 부르지 않고 점수 결과를 그대로 준다.
  // 통과하면 이 호출의 원가 상한을 먼저 잡아둔다(동시 요청이 함께 한도를 뚫지 못하게).
  const prompt = buildPrompt(candidates);
  const reserved = await reserveAiBudget({
    userId: args.userId,
    projectId: args.projectId,
    surface: "recommend",
    estimateUsd: maxCostUsd(MODEL, { prompt, maxOutputTokens: MAX_OUTPUT_TOKENS }),
  });
  if (!reserved.ok) return { recommendations: candidates, outcome: "budget" };
  const { reservation } = reserved;

  try {
    const { object, usage } = await generateObject({
      model: chatModel(),
      schema: rankingSchema,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    await settleAiUsage(reservation, usage);
    return { recommendations: mergeRanking(candidates, object.items), outcome: "ranked" };
  } catch (error) {
    await settleAiUsage(reservation, usageFromError(error));
    console.error("[ai-recommend] 랭킹 실패, 점수 결과로 폴백", error);
    return { recommendations: candidates, outcome: "error" };
  }
}

function buildPrompt(candidates: TestRecommendation[]): string {
  const list = candidates.map((c) => `- ${c.filePath} (${c.reason})`).join("\n");
  return [
    "Below is a list of source file paths that don't have a matching test file yet.",
    "Each line has signals measured from the code in parentheses: how many files import it, branch count, line count, risky domain.",
    "Rank how urgently each file needs tests. File contents are not provided, so judge by path, file name and those signals.",
    "Logic where bugs cause serious harm (auth, payments, permissions) is high, simple presentational UI is low, everything else is medium.",
    "reason is one English sentence (80 characters max). Never make up paths that aren't in the list.",
    "",
    list,
  ].join("\n");
}

// AI 가 준 경로만 우선순위·사유를 덮어쓰고, 빠뜨린 파일은 점수 값을 유지한다.
// 같은 우선순위 안에서는 점수 순서를 지킨다.
// AI 가 지어낸(목록에 없는) 경로는 Map 조회에서 자연히 버려진다.
//
// 다만 구조상 깎인 파일(deprioritized: 배럴·타입 전용·스토리·단순 UI)은 테스트할 로직이 거의
// 없다. AI 는 파일 본문을 못 보고 경로만 보므로 이런 파일을 "high" 로 올릴 수 있는데, 그러면
// 휴리스틱이 일부러 깎아둔 게 무위로 돌아가 상단으로 튄다. 그래서 이 파일들은 high 로는 못
// 올리고 medium 까지만 허용한다(내리는 건 자유). 프롬프트로도 "단순 UI 는 low"라 안내하지만
// 강제는 아니라 여기서 한 번 더 묶는다.
function mergeRanking(
  candidates: TestRecommendation[],
  items: z.infer<typeof rankingSchema>["items"]
): TestRecommendation[] {
  const byPath = new Map(items.map((i) => [i.filePath, i]));
  return candidates
    .map((c) => {
      const ai = byPath.get(c.filePath);
      if (!ai) return c;
      const priority = c.deprioritized && ai.priority === "high" ? "medium" : ai.priority;
      return { ...c, priority, reason: ai.reason };
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.score - a.score);
}
