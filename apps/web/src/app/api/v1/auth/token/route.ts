import {
  authenticateExtension,
  exchangeAuthCode,
  revokeExtensionToken,
  unauthorized,
} from "@/lib/extension/auth";

// 익스텐션 토큰 발급·폐기 (dante-extension 결정 D-6). 흐름은 lib/extension/auth.ts.

/** 1회용 code + code_verifier → 토큰. /api/v1 에서 유일하게 Bearer 없이 부르는 곳이다. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const { code, code_verifier: verifier } = (body ?? {}) as Record<string, unknown>;
  if (typeof code !== "string" || typeof verifier !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const issued = await exchangeAuthCode(code, verifier);
  if (!issued) return Response.json({ error: "invalid_grant" }, { status: 400 });

  // 토큰이 담긴 응답은 중간 캐시에 남으면 안 된다.
  return Response.json(
    { token: issued.token, expiresAt: issued.expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** 지금 쓰는 토큰을 폐기한다 (익스텐션 로그아웃). */
export async function DELETE(request: Request) {
  const token = await authenticateExtension(request);
  if (!token) return unauthorized();

  await revokeExtensionToken(token.id);
  return new Response(null, { status: 204 });
}
