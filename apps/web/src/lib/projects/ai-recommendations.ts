// 경로 휴리스틱이 추린 후보(getTestRecommendations)를 AI 로 다시 우선순위 매긴다 (서버 전용).
//
// 토큰이 커지는 건 '파일 본문'을 넣을 때뿐이다. 여기서는 본문을 넣지 않는다 —
// 후보 30개의 '경로 목록'만 보내고, AI 는 이름만으로 우선순위/사유를 준다.
// 그래서 입력이 리포 크기와 무관하다(파일이 1만 개여도 후보 30개만 본다).
//
// 실패하거나 예산을 넘겼으면 후보(휴리스틱 결과)를 그대로 돌려준다 — 버튼을 눌러도
// 화면이 비지 않고, 최소한 경로 기준 정렬은 유지된다.

import { generateObject } from "ai";
import { z } from "zod";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import { chatModel } from "@/lib/ai/chat-model";
import { recordAiUsage } from "@/lib/ai/usage";
import type { ProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations, type TestRecommendation } from "./recommendations";

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
 *   budget — 이번 달 예산 초과라 AI 를 건너뛰고 휴리스틱을 그대로 줬다
 *   error  — AI 호출이 실패해(키·모델 등) 휴리스틱으로 폴백했다
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
  // 1단계: 경로 휴리스틱으로 후보 30개까지 컷 (GitHub API 만, AI 토큰 0). 겸 폴백.
  const candidates = await getTestRecommendations(args.repo);
  if (candidates.length === 0) return { recommendations: [], outcome: "ranked" };

  // 이번 달 예산을 넘겼으면 AI 를 부르지 않고 휴리스틱 결과를 그대로 준다.
  const budget = await getMonthlyBudgetStatus(args.userId);
  if (budget.exceeded) return { recommendations: candidates, outcome: "budget" };

  try {
    const { object, usage } = await generateObject({
      model: chatModel(),
      schema: rankingSchema,
      prompt: buildPrompt(candidates),
    });
    await recordAiUsage({
      userId: args.userId,
      projectId: args.projectId,
      surface: "recommend",
      usage,
    });
    return { recommendations: mergeRanking(candidates, object.items), outcome: "ranked" };
  } catch (error) {
    console.error("[ai-recommend] 랭킹 실패, 휴리스틱으로 폴백", error);
    return { recommendations: candidates, outcome: "error" };
  }
}

function buildPrompt(candidates: TestRecommendation[]): string {
  const list = candidates.map((c) => `- ${c.filePath}`).join("\n");
  return [
    "다음은 대응 테스트 파일이 아직 없는 소스 파일 경로 목록이다.",
    "각 파일에 테스트를 먼저 써야 할 우선순위를 매겨라. 파일 내용은 주어지지 않으니 경로·파일명만으로 판단한다.",
    "인증·결제·권한처럼 틀리면 크게 다치는 로직은 high, 단순 표현용 UI 는 low, 나머지는 medium.",
    "reason 은 한국어 한 문장(80자 이내). 목록에 없는 경로는 만들어내지 마라.",
    "",
    list,
  ].join("\n");
}

// AI 가 준 경로만 우선순위·사유를 덮어쓰고, 빠뜨린 파일은 휴리스틱 값을 유지한다.
// AI 가 지어낸(목록에 없는) 경로는 Map 조회에서 자연히 버려진다.
function mergeRanking(
  candidates: TestRecommendation[],
  items: z.infer<typeof rankingSchema>["items"]
): TestRecommendation[] {
  const byPath = new Map(items.map((i) => [i.filePath, i]));
  return candidates
    .map((c) => {
      const ai = byPath.get(c.filePath);
      return ai ? { ...c, priority: ai.priority, reason: ai.reason } : c;
    })
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.filePath.localeCompare(b.filePath)
    );
}
