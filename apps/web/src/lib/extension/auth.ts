import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, prisma } from "@dante/db";

// ⚠️ 서버 전용.
//
// 익스텐션 로그인 (dante-extension docs/결정-기록.md D-6).
//
//   1. 익스텐션이 /auth/extension?state&code_challenge&redirect 를 브라우저로 연다
//   2. 사용자가 "연결"을 누르면 1회용 code 를 만들어 redirect(에디터)로 돌려보낸다
//   3. 익스텐션이 POST /api/v1/auth/token 에 code + code_verifier 를 보내 토큰을 받는다
//
// 토큰을 URL 에 바로 싣지 않는 이유: URL 은 OS 로그·브라우저 기록에 남는다.
// code 는 60초 뒤 죽고, 한 번 쓰면 사라지고, verifier 없이는 못 쓴다(PKCE).

/** 1회용 code 수명. "연결" → 브라우저의 "에디터 열기" 확인까지만 버티면 된다. */
const CODE_TTL_MS = 60_000;
/** 토큰 수명. 갱신은 없고, 지나면 다시 로그인한다. */
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** lastUsedAt 을 이보다 자주 쓰지 않는다 — 요청마다 UPDATE 가 나가지 않게. */
const LAST_USED_THROTTLE_MS = 60_000;
/** 토큰 접두사. 로그나 유출된 파일에서 "Dante 토큰"임을 바로 알아보게 한다. */
const TOKEN_PREFIX = "dnt_";

/** 마켓플레이스 익스텐션 ID (`<publisher>.<name>`, dante-extension 의 package.json). */
const EXTENSION_ID = "dante-lib.dante";

/**
 * redirect 로 허용하는 URI 스킴 → 화면에 보여줄 에디터 이름.
 * VS Code 계열 에디터는 각자 스킴이 달라서, 익스텐션은 vscode.env.uriScheme 으로
 * 자기 스킴을 만들어 보낸다.
 */
const EDITOR_SCHEMES = new Map([
  ["vscode", "VS Code"],
  ["vscode-insiders", "VS Code Insiders"],
  ["cursor", "Cursor"],
  ["windsurf", "Windsurf"],
  ["vscodium", "VSCodium"],
]);

/** RFC 7636: S256 결과(32바이트)를 base64url 로 쓰면 43자. */
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** RFC 7636: code_verifier 는 43~128자, unreserved 문자만. */
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
/** state 는 익스텐션이 만든 값을 되돌려줄 뿐이라 모양만 본다. */
const STATE_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

export type AuthorizeRequest = {
  state: string;
  codeChallenge: string;
  redirect: URL;
  editor: string;
};

function hashSecret(value: string) {
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
 */
export function parseAuthorizeParams(params: Record<string, unknown>): AuthorizeRequest | null {
  const { state, code_challenge, code_challenge_method, redirect } = params;

  if (typeof state !== "string" || !STATE_PATTERN.test(state)) return null;
  if (typeof code_challenge !== "string" || !CHALLENGE_PATTERN.test(code_challenge)) return null;
  // plain 방식은 받지 않는다. challenge 가 곧 verifier 라 가로채면 끝이다.
  if (code_challenge_method !== "S256") return null;
  if (typeof redirect !== "string") return null;

  const target = parseEditorRedirect(redirect);
  if (!target) return null;

  return { state, codeChallenge: code_challenge, redirect: target.url, editor: target.editor };
}

/** 1회용 code 를 만들고, 에디터로 돌려보낼 URL(code·state 포함)을 돌려준다. */
export async function issueAuthCode(userId: string, request: AuthorizeRequest) {
  const code = randomBytes(32).toString("base64url");

  await prisma.extensionAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      userId,
      codeChallenge: request.codeChallenge,
      editor: request.editor,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const target = new URL(request.redirect);
  target.searchParams.set("code", code);
  target.searchParams.set("state", request.state);
  return target.toString();
}

/**
 * 동의 화면의 "취소" 로 에디터에 돌려보낼 URL (RFC 6749 §4.1.2.1 `error=access_denied`).
 *
 * 취소는 DB 에 흔적을 남기지 않는다 — code 도 만들지 않는다. 발급된 것이 없으니
 * 만료·폐기할 것도 없고, 익스텐션은 이 URL 의 state 만 보고 대기 중인 로그인을 버린다.
 * 로그인 시작 전에 아무나 여는 페이지라 취소 한 번마다 행이 생기면 그것만으로 테이블이 찬다.
 */
export function buildDenyUrl(request: AuthorizeRequest) {
  const target = new URL(request.redirect);
  target.searchParams.set("error", "access_denied");
  target.searchParams.set("state", request.state);
  return target.toString();
}

/**
 * code + code_verifier → 새 토큰. 실패하면 null.
 *
 * 없는 code, 만료, 이미 쓴 code, verifier 불일치를 구분하지 않는다 — 어느 쪽이
 * 틀렸는지 알려주면 공격자에게 힌트가 된다.
 */
export async function exchangeAuthCode(code: string, verifier: string) {
  if (!VERIFIER_PATTERN.test(verifier) || code.length > 128) return null;

  // 지우는 것이 곧 "사용"이다. 조회 → 삭제로 나누면 같은 code 로 두 요청이
  // 동시에 들어왔을 때 둘 다 통과한다. delete 는 한쪽만 성공한다.
  let row;
  try {
    row = await prisma.extensionAuthCode.delete({ where: { codeHash: hashSecret(code) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }

  if (row.expiresAt.getTime() < Date.now()) return null;
  if (!matchesChallenge(verifier, row.codeChallenge)) return null;

  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.extensionToken.create({
    data: { userId: row.userId, tokenHash: hashSecret(token), editor: row.editor, expiresAt },
  });

  return { token, expiresAt };
}

function matchesChallenge(verifier: string, challenge: string) {
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * `Authorization: Bearer <token>` 을 검증한다. 통과하면 토큰 행(사용자 포함), 아니면 null.
 * /api/v1 라우트는 전부 이걸 먼저 부른다.
 */
export async function authenticateExtension(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  if (!token?.startsWith(TOKEN_PREFIX)) return null;

  const row = await prisma.extensionToken.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { user: true },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  const now = new Date();
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.extensionToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }

  return row;
}

/** 토큰 폐기. 이미 없으면 아무 일도 없다. */
export async function revokeExtensionToken(id: string) {
  await prisma.extensionToken.deleteMany({ where: { id } });
}

/** /api/v1 공통 401. */
export function unauthorized() {
  return Response.json(
    { error: "unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
  );
}
