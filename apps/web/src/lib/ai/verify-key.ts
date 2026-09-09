import { type AiProviderId } from "@/lib/projects/ai-providers";

// ⚠️ 서버 전용. 사용자가 넣은 키를 그대로 실어 보낸다.
//
// 형식만 보고 저장하면 잘못된 키가 조용히 들어앉았다가 한참 뒤 "테스트 생성이
// 안 돼요"로 돌아온다. 그래서 저장 전에 한 번 실제로 물어본다.
//
// 셋 다 모델 목록 조회를 쓴다 — 토큰을 소모하지 않고 인증만 확인하는 가장 싼
// 엔드포인트다.

const ENDPOINTS: Record<AiProviderId, (key: string) => [string, HeadersInit]> = {
  anthropic: (key) => [
    "https://api.anthropic.com/v1/models?limit=1",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
  ],
  openai: (key) => ["https://api.openai.com/v1/models", { authorization: `Bearer ${key}` }],
  google: (key) => [
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    { "x-goog-api-key": key },
  ],
};

/** 벤더가 키를 거절하면 false. 벤더에 못 닿았으면 null(판단 보류). */
export async function verifyApiKey(provider: AiProviderId, key: string): Promise<boolean | null> {
  const [url, headers] = ENDPOINTS[provider](key);

  try {
    const response = await fetch(url, {
      headers,
      // 온보딩 화면이 벤더 응답을 하염없이 기다리게 두지 않는다.
      signal: AbortSignal.timeout(8_000),
    });

    if (response.ok) return true;
    // 401·403 만 "키가 틀렸다"로 본다. 429(요청 과다)는 인증은 통과한 것이고,
    // 5xx 는 벤더 사정이라 사용자 키 탓으로 돌리면 안 된다.
    if (response.status === 401 || response.status === 403) return false;
    return null;
  } catch {
    // 네트워크 실패·타임아웃. 벤더 장애로 온보딩을 막지는 않는다.
    return null;
  }
}
