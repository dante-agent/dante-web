// 로그인 화면. 지금은 루트가 로그인 화면이다 (src/app/page.tsx).
export const LOGIN_PATH = "/";

// 로그인 후 기본 도착지. 로그인이 필요한 페이지로 들어오려다 튕긴 경우에만
// proxy 가 ?next=<원래 경로> 를 붙여주고, 그때는 그쪽을 우선한다.
export const DEFAULT_NEXT = "/projects";

/**
 * ?next= 값을 그대로 믿지 않는다 (오픈 리다이렉트 방지).
 * 공격자가 ?next=https://evil.com 이나 ?next=//evil.com 을 붙인 링크를 뿌리면
 * 우리 도메인에서 로그인한 직후 외부 사이트로 튕겨나가게 만들 수 있다.
 * 그래서 "우리 사이트 안의 경로"만 통과시킨다.
 * ("//evil.com" 은 "/" 로 시작하지만 브라우저가 외부 URL 로 읽으므로 따로 막는다.)
 */
export function safeNext(value: string | string[] | null | undefined) {
  if (typeof value !== "string") return DEFAULT_NEXT;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_NEXT;
  return value;
}
