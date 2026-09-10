// 테스트를 써줄 LLM 프로바이더.
//
// 온보딩에서는 "어느 회사 키를 쓸지"만 고른다. 모델까지 고르게 하면 단계가
// 무거워지고, 모델은 몇 달마다 바뀌는데 그때마다 온보딩을 고쳐야 한다.
// 어떤 모델을 부를지는 생성 PR 에서 정한다 — 여기에 모델 이름을 적어두면
// 화면에 안 쓰이면서 낡기만 한다.
//
// id 는 Vercel AI SDK 의 프로바이더 이름과 맞춘다(@ai-sdk/anthropic 등).
// UserApiKey.provider 에 그대로 들어가는 값이다.

export const AI_PROVIDERS = [
  {
    id: "anthropic",
    /** 카드에 크게 보이는 이름. 사용자는 회사가 아니라 모델 이름으로 기억한다. */
    name: "Claude",
    vendor: "Anthropic",
    tagline: "Reads an unfamiliar codebase closely and matches the conventions already there.",
    /** 형식 검사 — 오타·프로바이더 착각을 API 왕복 전에 걸러낸다. */
    keyPattern: /^sk-ant-/,
    keyHint: "Anthropic keys start with sk-ant-",
    placeholder: "sk-ant-api03-...",
    consoleUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "GPT",
    vendor: "OpenAI",
    tagline: "The family behind Codex. Holds up over long runs with many tool calls.",
    // sk-ant- 도 sk- 로 시작한다. Anthropic 키를 여기 붙이는 실수를 막는다.
    keyPattern: /^sk-(?!ant-)/,
    keyHint: "OpenAI keys start with sk- (not sk-ant-)",
    placeholder: "sk-proj-...",
    consoleUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    name: "Gemini",
    vendor: "Google",
    tagline: "The cheapest of the three. Useful when a repo has a lot of files to sweep.",
    keyPattern: /^AIza/,
    keyHint: "Google AI Studio keys start with AIza",
    placeholder: "AIza...",
    consoleUrl: "https://aistudio.google.com/apikey",
  },
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];
export type AiProvider = (typeof AI_PROVIDERS)[number];

export function isAiProvider(value: string): value is AiProviderId {
  return AI_PROVIDERS.some((provider) => provider.id === value);
}

export function findAiProvider(id: AiProviderId): AiProvider {
  // isAiProvider 로 좁힌 값만 들어오므로 못 찾는 경우는 없다.
  return AI_PROVIDERS.find((provider) => provider.id === id)!;
}
