import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// 익스텐션 로그인의 순수 로직 (dante-extension 결정 D-6). DB 를 모른다.
//
// auth.ts 가 Prisma 를 붙여 쓰고, authorize.test.ts 가 DB 없이 검증한다.
// node --test 가 경로 별칭(@/…)을 풀지 못하므로 이 파일은 node: 모듈만 import 한다.

/** 마켓플레이스 익스텐션 ID (`<publisher>.<name>`, dante-extension 의 package.json). */
const EXTENSION_ID = "dante-lib.dante";

/**
 * 에디터 URI 스킴 → 화면에 보여줄 에디터 이름.
 * VS Code 계열 에디터는 각자 스킴이 달라서, 익스텐션은 vscode.env.uriScheme 으로
 * 자기 스킴을 알려준다.
 */
const EDITOR_SCHEMES = new Map([
  ["vscode", "VS Code"],
  ["vscode-insiders", "VS Code Insiders"],
  ["cursor", "Cursor"],
  ["windsurf", "Windsurf"],
  ["vscodium", "VSCodium"],
]);

/** 에디터로 돌려보내는 code 수명. "연결" → 브라우저의 "에디터 열기" 확인까지만 버티면 된다. */
export const REDIRECT_CODE_TTL_MS = 60_000;
/** 사람이 옮겨 적는 code 수명. 다른 창·기기로 옮겨 붙여넣을 시간을 준다. */
export const MANUAL_CODE_TTL_MS = 5 * 60_000;

/** RFC 7636: S256 결과(32바이트)를 base64url 로 쓰면 43자. */
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** RFC 7636: code_verifier 는 43~128자, unreserved 문자만. */
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
/** state 는 익스텐션이 만든 값을 되돌려줄 뿐이라 모양만 본다. */
const STATE_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

/**
 * 수동 code 의 글자. Crockford base32 — 0/O, 1/I/L 처럼 헷갈리는 쌍이 없고 U 도 뺐다.
 * 사람이 잘못 읽은 O·I·L 은 canonicalCode 가 0·1 로 되돌린다.
 */
const MANUAL_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 12자 × 5비트 = 60비트. code 만으로는 토큰을 못 받으니(PKCE) 대입 방지가 아니라 충돌 방지용 길이다. */
const MANUAL_CODE_LENGTH = 12;

export type AuthorizeRequest = {
  state: string;
  codeChallenge: string;
  editor: string;
  /** 에디터 URI 로 돌려보낼지, 화면에 code 를 보여주고 사람이 옮기게 할지. */
  delivery: { kind: "redirect"; url: URL } | { kind: "manual"; scheme: string };
};

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 익스텐션이 넘긴 redirect 를 검사한다.
 *
 * 검사하지 않으면 공격자가 redirect=https://evil.com 을 붙인 링크를 뿌려,
 * 사용자가 "연결"을 누르는 순간 code 를 가져간다. PKCE 때문에 code 만으로는
 * 토큰을 못 받지만, 막을 수 있는 건 앞에서 막는다.
 */
function parseEditorRedirect(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const editor = EDITOR_SCHEMES.get(url.protocol.slice(0, -1));
  if (!editor) return null;

  // 호스트는 우리 익스텐션 ID, 경로는 /auth 로 고정한다. 같은 에디터의
  // 다른 익스텐션으로 code 가 새지 않게. (VS Code 는 익스텐션 ID 대소문자를 가리지 않는다.)
  if (url.host.toLowerCase() !== EXTENSION_ID || url.pathname !== "/auth") return null;
  if (url.search || url.hash || url.username || url.password) return null;

  return { url, editor };
}

/**
 * 동의 화면에 들어온 쿼리를 검사한다. 페이지(보여줄지)와 서버 액션(발급할지)이
 * 같은 걸 쓴다 — 액션은 클라이언트가 되돌려준 값을 다시 믿지 않고 여기서 또 본다.
 *
 * `redirect=manual` 은 브라우저에서 에디터로 넘어가는 링크가 닿지 않는 환경
 * (원격 SSH, Codespaces, 다른 기기의 브라우저)을 위한 것이다. 돌아갈 스킴이 없으니
 * 에디터 이름은 `editor_scheme` 으로 따로 받아 같은 목록으로 확인한다.
 */
export function parseAuthorizeParams(params: Record<string, unknown>): AuthorizeRequest | null {
  const { state, code_challenge, code_challenge_method, redirect, editor_scheme } = params;

  if (typeof state !== "string" || !STATE_PATTERN.test(state)) return null;
  if (typeof code_challenge !== "string" || !CHALLENGE_PATTERN.test(code_challenge)) return null;
  // plain 방식은 받지 않는다. challenge 가 곧 verifier 라 가로채면 끝이다.
  if (code_challenge_method !== "S256") return null;
  if (typeof redirect !== "string") return null;

  if (redirect === "manual") {
    const editor = typeof editor_scheme === "string" ? EDITOR_SCHEMES.get(editor_scheme) : null;
    if (!editor) return null;
    return {
      state,
      codeChallenge: code_challenge,
      editor,
      delivery: { kind: "manual", scheme: editor_scheme as string },
    };
  }

  const target = parseEditorRedirect(redirect);
  if (!target) return null;

  return {
    state,
    codeChallenge: code_challenge,
    editor: target.editor,
    delivery: { kind: "redirect", url: target.url },
  };
}

/** 페이지 → 서버 액션으로 되돌려줄 쿼리. 액션은 이걸 다시 parseAuthorizeParams 로 본다. */
export function toAuthorizeParams(request: AuthorizeRequest): Record<string, string> {
  const params: Record<string, string> = {
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
  };
  if (request.delivery.kind === "redirect") {
    params.redirect = request.delivery.url.toString();
  } else {
    params.redirect = "manual";
    params.editor_scheme = request.delivery.scheme;
  }
  return params;
}

/**
 * 새 1회용 code 와 수명.
 *
 * 에디터로 보내는 code 는 사람이 볼 일이 없어 길게(43자), 수동 code 는 옮겨 적을 수
 * 있게 짧게(XXXX-XXXX-XXXX) 만든다. 짧아도 되는 이유: code 는 verifier 없이는
 * 토큰이 되지 않고, 한 번 시도하면(틀려도) 사라진다.
 */
export function createAuthCode(delivery: AuthorizeRequest["delivery"]) {
  if (delivery.kind === "redirect") {
    return { code: randomBytes(32).toString("base64url"), ttlMs: REDIRECT_CODE_TTL_MS };
  }

  let raw = "";
  for (let i = 0; i < MANUAL_CODE_LENGTH; i++) raw += MANUAL_ALPHABET[randomInt(32)];
  return { code: raw.match(/.{4}/g)!.join("-"), ttlMs: MANUAL_CODE_TTL_MS };
}

/**
 * 받은 code 를 저장할 때와 같은 모양으로 맞춘다.
 *
 * 수동 code 는 사람이 옮기므로 대소문자, 하이픈·공백, O↔0 · I/L↔1 을 너그럽게 받는다.
 * 에디터로 보내는 code(43자 base64url)는 대소문자를 구분하므로 건드리지 않는다 —
 * 정리한 결과가 12자일 때만 수동 code 로 본다.
 */
export function canonicalCode(code: string) {
  const cleaned = code.replace(/[\s-]/g, "").toUpperCase();
  if (cleaned.length !== MANUAL_CODE_LENGTH) return code;

  const mapped = cleaned.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (![...mapped].every((c) => MANUAL_ALPHABET.includes(c))) return code;
  return mapped.match(/.{4}/g)!.join("-");
}

export type StoredAuthCode = {
  userId: string;
  codeChallenge: string;
  editor: string;
  expiresAt: Date;
};

/**
 * code + code_verifier 를 확인한다. 통과하면 code 행, 아니면 null.
 *
 * `take` 는 code 해시로 행을 꺼내면서 지워야 한다 — 지우는 것이 곧 "사용"이다.
 * 조회 → 삭제로 나누면 같은 code 로 두 요청이 동시에 들어왔을 때 둘 다 통과한다.
 * verifier 가 틀려도 이미 지웠으므로, code 하나에 시도는 한 번뿐이다.
 *
 * 없는 code, 만료, 이미 쓴 code, verifier 불일치를 구분하지 않는다 — 어느 쪽이
 * 틀렸는지 알려주면 공격자에게 힌트가 된다.
 */
export async function redeemAuthCode(
  code: string,
  verifier: string,
  take: (codeHash: string) => Promise<StoredAuthCode | null>,
  now = Date.now()
) {
  if (!VERIFIER_PATTERN.test(verifier) || code.length > 128) return null;

  const row = await take(hashSecret(canonicalCode(code)));
  if (!row) return null;
  if (row.expiresAt.getTime() < now) return null;
  if (!matchesChallenge(verifier, row.codeChallenge)) return null;
  return row;
}

function matchesChallenge(verifier: string, challenge: string) {
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
