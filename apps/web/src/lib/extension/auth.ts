import { randomBytes } from "node:crypto";
import { Prisma, prisma } from "@dante/db";
import {
  createAuthCode,
  hashSecret,
  redeemAuthCode,
  type AuthorizeRequest,
} from "@/lib/extension/authorize";

// ⚠️ 서버 전용.
//
// 익스텐션 로그인 (dante-extension docs/결정-기록.md D-6).
//
//   1. 익스텐션이 /auth/extension?state&code_challenge&redirect 를 브라우저로 연다
//   2. 사용자가 "연결"을 누르면 1회용 code 를 만들어 redirect(에디터)로 돌려보낸다
//      redirect=manual 이면 code 를 화면에 보여주고, 사용자가 에디터에 붙여넣는다
//   3. 익스텐션이 POST /api/v1/auth/token 에 code + code_verifier 를 보내 토큰을 받는다
//
// 토큰을 URL 에 바로 싣지 않는 이유: URL 은 OS 로그·브라우저 기록에 남는다.
// code 는 곧 죽고(60초, 수동은 5분), 한 번 쓰면 사라지고, verifier 없이는 못 쓴다(PKCE).
// 검사 규칙은 authorize.ts 에 있다.

export { parseAuthorizeParams, toAuthorizeParams } from "@/lib/extension/authorize";
export type { AuthorizeRequest } from "@/lib/extension/authorize";

/** 토큰 수명. 갱신은 없고, 지나면 다시 로그인한다. */
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** lastUsedAt 을 이보다 자주 쓰지 않는다 — 요청마다 UPDATE 가 나가지 않게. */
const LAST_USED_THROTTLE_MS = 60_000;
/** 토큰 접두사. 로그나 유출된 파일에서 "Dante 토큰"임을 바로 알아보게 한다. */
const TOKEN_PREFIX = "dnt_";

/**
 * 1회용 code 를 만든다. redirect 면 에디터로 돌려보낼 URL(code·state 포함)을,
 * manual 이면 화면에 보여줄 code 와 만료 시각을 돌려준다.
 */
export async function issueAuthCode(userId: string, request: AuthorizeRequest) {
  const { code, ttlMs } = createAuthCode(request.delivery);
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.extensionAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      userId,
      codeChallenge: request.codeChallenge,
      editor: request.editor,
      expiresAt,
    },
  });

  if (request.delivery.kind === "manual") {
    return { kind: "manual" as const, code, expiresAt };
  }

  const target = new URL(request.delivery.url);
  target.searchParams.set("code", code);
  target.searchParams.set("state", request.state);
  return { kind: "redirect" as const, url: target.toString() };
}

/**
 * 동의 화면의 "취소" 로 에디터에 돌려보낼 URL (RFC 6749 §4.1.2.1 `error=access_denied`).
 * 수동 모드는 돌아갈 곳이 없어 null — 에디터의 입력창은 사용자가 닫는다.
 *
 * 취소는 DB 에 흔적을 남기지 않는다 — code 도 만들지 않는다. 발급된 것이 없으니
 * 만료·폐기할 것도 없고, 익스텐션은 이 URL 의 state 만 보고 대기 중인 로그인을 버린다.
 * 로그인 시작 전에 아무나 여는 페이지라 취소 한 번마다 행이 생기면 그것만으로 테이블이 찬다.
 */
export function buildDenyUrl(request: AuthorizeRequest) {
  if (request.delivery.kind === "manual") return null;

  const target = new URL(request.delivery.url);
  target.searchParams.set("error", "access_denied");
  target.searchParams.set("state", request.state);
  return target.toString();
}

/** code + code_verifier → 새 토큰. 실패하면 null. 실패 사유는 구분하지 않는다. */
export async function exchangeAuthCode(code: string, verifier: string) {
  const row = await redeemAuthCode(code, verifier, async (codeHash) => {
    // delete 는 동시에 들어온 두 요청 중 한쪽만 성공한다.
    try {
      return await prisma.extensionAuthCode.delete({ where: { codeHash } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  });
  if (!row) return null;

  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.extensionToken.create({
    data: { userId: row.userId, tokenHash: hashSecret(token), editor: row.editor, expiresAt },
  });

  return { token, expiresAt };
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
