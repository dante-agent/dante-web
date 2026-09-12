// 모델 단가표. 토큰 수를 원가(USD)로 바꾼다.
//
// 원가로 세는 이유: 한도를 토큰 수로 걸면 모델을 바꾸는 순간 같은 숫자가 다른 돈을
// 뜻하게 돼서 한도를 매번 다시 잡아야 한다. 달러로 세면 모델이 바뀌어도 "한 달에
// $N" 의 의미가 그대로다.
//
// ⚠️ 이 값은 OpenAI 공시 단가를 사람이 옮겨 적은 것이다. API 로 받아올 수 없어서
// (모델 목록 엔드포인트는 가격을 주지 않는다) 모델을 추가·교체할 때 여기도 같이
// 고쳐야 한다. 안 고치면 조용히 원가가 틀린다 — 그래서 모르는 모델은 0 으로
// 넘기지 않고 null 을 돌려준다.
//
// 출처: https://developers.openai.com/api/docs/pricing (2026-09-12 확인)

/** 100만 토큰당 USD. */
type Rate = {
  input: number;
  /** 캐시에서 읽은 입력. 보통 input 의 1/10 이라 따로 세지 않으면 원가가 부풀려진다. */
  cachedInput: number;
  output: number;
};

const RATES: Record<string, Rate> = {
  // standard 기준. fast 모드는 2배인데 우리는 쓰지 않는다.
  "gpt-5.3-codex": { input: 1.75, cachedInput: 0.175, output: 14.0 },
};

const PER_MILLION = 1_000_000;

export type TokenCounts = {
  /** 전체 입력 토큰. cached 를 포함한 값이다(AI SDK 의 inputTokens 가 그렇다). */
  inputTokens: number | undefined;
  cachedInputTokens: number | undefined;
  outputTokens: number | undefined;
};

/**
 * 원가(USD). 단가를 모르는 모델이거나 토큰 수를 못 받았으면 null.
 *
 * null 을 0 과 구분하는 게 중요하다. 0 으로 접으면 "공짜로 썼다"가 되어 한도가
 * 조용히 뚫린다. null 이면 "이 건은 원가를 모른다"로 남고, 합계를 낼 때 그 사실이
 * 보인다.
 */
export function costUsd(model: string, tokens: TokenCounts): number | null {
  const rate = RATES[model];
  if (!rate) return null;

  const { inputTokens, cachedInputTokens, outputTokens } = tokens;
  if (inputTokens === undefined || outputTokens === undefined) return null;

  // inputTokens 는 캐시 읽은 분을 포함한 총량이다. 캐시분을 빼고 남은 것이
  // 제값을 내는 입력이다. 프로바이더가 어긋난 값을 주더라도 음수가 되지 않게 막는다.
  const cached = Math.min(cachedInputTokens ?? 0, inputTokens);
  const fresh = inputTokens - cached;

  const usd =
    (fresh * rate.input + cached * rate.cachedInput + outputTokens * rate.output) / PER_MILLION;

  // Decimal(12,6) 컬럼에 맞춰 자른다. 여기서 안 자르면 Prisma 가 반올림하는데,
  // 그 규칙이 우리 합계 계산과 다를 수 있다.
  return Number(usd.toFixed(6));
}

/** 단가를 아는 모델인지. 배포 전 점검이나 테스트에서 쓴다. */
export function hasRate(model: string): boolean {
  return model in RATES;
}
