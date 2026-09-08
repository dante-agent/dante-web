import { randomBytes, timingSafeEqual } from "node:crypto";

// 설치 흐름의 CSRF 방어용 1회용 난수.
//
// GitHub 은 우리가 설치 URL 에 붙인 state 를 Setup URL 로 그대로 돌려준다.
// 그 값이 우리가 방금 쿠키에 심어둔 값과 같아야 "이 설치는 우리 사이트에서
// 시작된 것"이라고 볼 수 있다. 없으면 공격자가 자기 설치 ID 를 남의 계정에
// 붙이는 링크를 만들 수 있다.

export const INSTALL_STATE_COOKIE = "dante_gh_install_state";

/** 설치를 시작하고 돌아오기까지 10분. 그 이상 걸리면 다시 시작하는 게 맞다. */
export const INSTALL_STATE_MAX_AGE = 60 * 10;

export function createInstallState() {
  return randomBytes(32).toString("base64url");
}

/** 길이가 달라도 예외 없이 false. 비교 시간이 값에 따라 달라지지 않게 한다. */
export function matchesState(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
