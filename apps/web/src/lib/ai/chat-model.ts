import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// ⚠️ 서버 전용. Dante 의 프로바이더 키를 쓴다.
//
// 예전에는 사용자가 저장해둔 키를 복호화해서 썼다(BYOK). 지금은 Dante 가 OpenAI
// 와 직접 계약하고 서버 키 하나로 부른다 — 사용자는 프로바이더를 고르지도,
// 키를 넣지도 않는다. 그래서 이 함수는 인자를 받지 않고 늘 같은 모델을 준다.
//
// 모델 id 는 이 파일에만 적는다. 모델은 몇 달마다 바뀌는데 이름이 여러 곳에
// 흩어져 있으면 바꿀 때 한 곳을 빠뜨린다. engine.ts 는 화면에 보일 이름만 갖고,
// 그 이름과 실제로 부르는 모델은 따로 움직인다.
const MODEL = "gpt-5.3-codex";

/**
 * 채팅·생성이 부르는 모델.
 *
 * 키가 없으면 여기서 바로 던진다. 조용히 넘기면 AI SDK 가 한참 뒤에 401 로
 * 떨어지고, 그 에러는 화면에서 "사용자 요청이 잘못됐다"처럼 읽힌다 — 실제로는
 * 우리 배포 설정이 빠진 것이라 사용자가 할 수 있는 일이 없다.
 */
export function chatModel(): LanguageModel {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다.");

  return createOpenAI({ apiKey })(MODEL);
}
