// 생성 품질. Standard 와 Deep 은 같은 모델(chat-model.ts)을 부르고, 답하기 전에
// 얼마나 오래 추론하게 할지(reasoning effort)만 다르다.
//
// 모델을 바꾸는 안도 있었다. 그러면 단가표(pricing.ts)와 사용량 기록이 품질마다
// 갈라지고, 엔진 선택과도 겹친다. effort 만 바꾸면 단가는 그대로이고 원가 차이는
// 출력 토큰 수로만 난다 — 추론에 쓴 토큰이 출력 단가($14/M)로 잡혀서 Deep 은 호출당
// 대략 1.5~3배로 본다(실측 전 추정).
//
// 이 파일은 prisma 를 부르지 않는다. 설정 폼(클라이언트)이 선택지와 문구를 같이 쓴다.
// 저장된 값 읽기는 quality-queries.ts.
//
// ⚠️ 지금은 저장과 노출까지만이다. 채팅(api/chat)은 이 값을 읽지 않고, 테스트 생성
// 파이프라인이 읽는 부분은 생성 담당과 맞춰야 한다. 읽는 쪽은 reasoningEffort() 로
// 바꿔서 providerOptions.openai.reasoningEffort 에 넘기면 된다.

export const AI_QUALITIES = ["standard", "deep"] as const;

export type AiQuality = (typeof AI_QUALITIES)[number];

export const DEFAULT_AI_QUALITY: AiQuality = "standard";

/** 설정 화면 문구. 원가가 늘어난다는 사실은 고르기 전에 보여야 한다. */
export const AI_QUALITY_OPTIONS: Record<AiQuality, { label: string; description: string }> = {
  standard: {
    label: "Standard",
    description: "Answers at the model's normal pace. Good for most work.",
  },
  deep: {
    label: "Deep",
    description:
      "Thinks longer before answering. Can be more careful on tricky code, but is slower and uses more of your monthly limit per call.",
  },
};

/** 폼이나 DB 에서 온 값을 좁힌다. 모르는 값이면 null. */
export function parseAiQuality(value: unknown): AiQuality | null {
  return typeof value === "string" && (AI_QUALITIES as readonly string[]).includes(value)
    ? (value as AiQuality)
    : null;
}

/**
 * 품질 → OpenAI reasoning effort.
 *
 * standard 를 medium 으로 둔 이유: 지금 채팅이 effort 를 넘기지 않아 프로바이더
 * 기본값(medium)으로 돈다. Standard 를 고른 사람의 원가가 지금과 같아야 한다.
 */
export function reasoningEffort(quality: AiQuality): "medium" | "high" {
  return quality === "deep" ? "high" : "medium";
}
