// 운영 지표 화면(/ops)을 볼 수 있는 사람을 가리는 규칙. 순수 함수다.
//
// 판정을 access.ts 에서 떼어 둔 이유: 그쪽은 next/navigation 과 Supabase 세션을
// 불러야 해서 `node --test` 로 부를 수 없다. 여기가 틀리면 남의 가입 목록이 열리거나
// 나까지 못 들어가거나 둘 중 하나라, 규칙만큼은 테스트가 붙는 자리에 둔다.

/**
 * 쉼표로 구분한 이메일 목록을 읽는다. 공백은 버리고 대소문자는 통일한다.
 *
 * 값은 사람이 Vercel 대시보드 입력칸에 손으로 적는다 — "a@x.com, b@x.com" 처럼
 * 쉼표 뒤에 공백을 넣는 게 자연스럽고, 그것 때문에 로그인이 막히면 원인을 찾기 어렵다.
 */
export function parseOpsAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 이 이메일이 지표 화면을 볼 수 있나.
 *
 * 목록이 비면 항상 false 다(fail closed). 환경변수를 빼먹었을 때 화면이 모두에게
 * 열리는 쪽으로 틀리면 안 된다 — 이 화면은 다른 사람들의 가입 목록을 담고 있다.
 * lib/ai/budget.ts 가 한도 환경변수를 다루는 판단과 같다.
 */
export function isOpsEmail(email: string | undefined | null, raw: string | undefined | null) {
  if (!email) return false;
  const allowed = parseOpsAllowlist(raw);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}
