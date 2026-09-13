import { createHash, randomBytes } from "node:crypto";

// 팀 초대의 순수 규칙. DB 없이 테스트할 수 있게 invites.ts 에서 뗐다(invite-rules.test.ts).

/** 초대 수명. 지나면 링크가 죽고, owner 가 같은 주소로 다시 보내면 새 링크가 나간다. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 팀 하나에 걸어 둘 수 있는 대기 중 초대 수. 폼을 반복 제출해 메일을 뿌리지 못하게. */
export const MAX_PENDING_INVITES = 50;

/** RFC 5321 의 주소 길이 상한. */
const EMAIL_MAX = 254;

// 주소가 "메일을 보낼 만한 모양"인지만 본다. 진짜 받는 주소인지는 보내 봐야 안다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 폼에서 온 주소를 저장할 모양으로. 모양이 틀리면 null.
 *
 * 소문자로 접는 이유: (teamId, email) 이 unique 라, 대소문자만 다른 주소가 초대를
 * 둘 만들지 않게 한다. 로컬 파트의 대소문자를 구분하는 메일 서버는 사실상 없다.
 */
export function normalizeEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/**
 * 링크에 실을 토큰과 DB 에 둘 해시.
 *
 * 토큰 원문은 저장하지 않는다(익스텐션 code 와 같다). DB 가 새도 링크를 만들 수 없다.
 * 32바이트면 추측으로 맞힐 수 없어서 느린 해시나 솔트가 필요 없다.
 */
export function createInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** base64url 32바이트 = 43자. 모양이 틀린 값은 DB 에 묻지 않는다. */
export function isInviteToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isExpired(expiresAt: Date, now = Date.now()) {
  return expiresAt.getTime() <= now;
}
