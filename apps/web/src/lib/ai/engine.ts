// 테스트를 써주는 엔진.
//
// 예전에는 사용자가 프로바이더를 고르고 자기 키를 넣었다(BYOK). 지금은 Dante 가
// 프로바이더와 직접 계약하고, 실제로 도는 건 Codex 하나다.
//
// 나머지 둘을 목록에서 빼지 않고 "Coming soon" 으로 남겨두는 이유: 온보딩 4단계는
// "무엇이 내 코드를 읽는가"를 보여주는 자리인데, 한 장짜리 목록은 그 질문 자체가
// 없는 것처럼 보인다. 셋을 나란히 두면 지금 무엇이 붙어 있고 무엇이 올 예정인지가
// 한 화면에서 읽힌다.
//
// 모델 id 는 여기 적지 않는다. 화면에 나가는 이름과 실제로 부르는 모델은 수명이
// 다르다 — 모델은 몇 달마다 바뀌지만 그때마다 이 이름을 고칠 이유는 없다.
// 어떤 모델을 부를지는 chat-model.ts 한 곳에서만 정한다.

export type Engine = {
  id: string;
  /** 카드에 크게 보이는 이름. 사용자는 회사가 아니라 모델 이름으로 기억한다. */
  name: string;
  vendor: string;
  tagline: string;
  /** false 면 카드가 흐려지고 COMING SOON 이 붙는다. 고를 수 없다. */
  available: boolean;
};

export const ENGINES: Engine[] = [
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    tagline: "Holds up over long runs with many tool calls.",
    available: true,
  },
  {
    id: "claude",
    name: "Claude",
    vendor: "Anthropic",
    tagline: "Reads an unfamiliar codebase closely and matches the conventions already there.",
    available: false,
  },
  {
    id: "gemini",
    name: "Gemini",
    vendor: "Google",
    tagline: "Cheap enough to sweep a repo with a lot of files.",
    available: false,
  },
];

/**
 * 지금 실제로 부르는 엔진.
 *
 * 목록에서 available 인 건 하나뿐이다. 둘 이상 열리는 날에는 이 상수가 아니라
 * 사용자가 고른 값을 읽어야 하므로, 그때 부르는 쪽을 같이 고쳐야 한다.
 */
export const ACTIVE_ENGINE = ENGINES.find((engine) => engine.available)!;
