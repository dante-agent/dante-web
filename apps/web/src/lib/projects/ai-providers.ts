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
    /** vendor 앞에 붙는 관사. 규칙으로 뽑으면 "an OpenAI"/"a Google" 을 못 맞춘다. */
    article: "an",
    tagline: "Reads an unfamiliar codebase closely and matches the conventions already there.",
    /** 형식 검사 — 오타·프로바이더 착각을 API 왕복 전에 걸러낸다. */
    keyPattern: /^sk-ant-/,
    /** 접두사로 끝내지 않는다 — 뒤에 마침표가 붙으면 "sk-ant-." 처럼 읽힌다. */
    keyHint: "Anthropic keys start with the sk-ant- prefix.",
    placeholder: "sk-ant-api03-...",
    consoleUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "GPT",
    vendor: "OpenAI",
    article: "an",
    tagline: "The family behind Codex. Holds up over long runs with many tool calls.",
    // sk-ant- 도 sk- 로 시작한다. Anthropic 키를 여기 붙이는 실수를 막는다.
    keyPattern: /^sk-(?!ant-)/,
    keyHint: "OpenAI keys start with the sk- prefix (but not sk-ant-).",
    placeholder: "sk-proj-...",
    consoleUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    name: "Gemini",
    vendor: "Google",
    article: "a",
    tagline: "The cheapest of the three. Useful when a repo has a lot of files to sweep.",
    keyPattern: /^AIza/,
    keyHint: "Google AI Studio keys start with the AIza prefix.",
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

// 키 입력 실패 문구.
//
// 온보딩과 계정 설정 두 화면이 같은 검사를 하므로 문구도 여기서 한 벌만 만든다.
// 양쪽에 흩어져 있던 동안 "Paste a key first." 와 "Paste your Anthropic API key,
// or skip this step." 처럼 같은 상황에서 다른 말이 나왔다. 화면마다 다른 부분은
// 인자로만 받는다.

/** 입력란이 비었을 때. 온보딩은 건너뛸 수 있으니 그 안내만 덧붙인다. */
export function emptyKeyMessage(provider: AiProvider, options?: { skippable?: boolean }): string {
  const ask = `Paste your ${provider.vendor} API key`;
  return options?.skippable ? `${ask}, or skip this step.` : `${ask}.`;
}

/** 형식이 안 맞을 때 — 벤더를 착각한 경우가 대부분이라 접두사를 같이 알려준다. */
export function invalidKeyFormatMessage(provider: AiProvider): string {
  return `That is not ${provider.article} ${provider.vendor} key format. ${provider.keyHint}`;
}

/** 형식은 맞는데 벤더가 거절했을 때. */
export function rejectedKeyMessage(provider: AiProvider): string {
  return `${provider.vendor} rejected this key. Check that it is active and try again.`;
}
