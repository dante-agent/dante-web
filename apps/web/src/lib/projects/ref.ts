import { randomBytes } from "node:crypto";

// URL 에 쓰는 짧은 불투명 식별자. nanoid 같은 패키지를 넣지 않고 직접 만든다
// (몇 줄로 되는 일은 의존성 대신 직접 — AGENTS.md).
//
// 숫자·소문자에서 헷갈리는 글자(0/o, 1/l/i)를 뺀 32자 알파벳.
// 사용자가 URL 을 눈으로 읽거나 옮겨 적을 때 실수를 줄인다.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const LENGTH = 12;

/**
 * 12자면 31^12 ≈ 7.9e17 가지다. 충돌은 사실상 없지만 unique 제약이 있으므로
 * 만에 하나 부딪히면 DB 가 막아준다(호출부에서 재시도).
 */
export function createProjectRef() {
  // 256 % 31 != 0 이라 바이트를 그대로 나머지 연산하면 앞쪽 글자가 살짝 더 자주
  // 나온다. 알파벳 크기를 32 로 맞춰 5비트씩 정확히 잘라 쓰면 편향이 없다.
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}
