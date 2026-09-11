import { authenticateExtension, unauthorized } from "@/lib/extension/auth";

// 토큰 검증 + 누구로 로그인했는지. 익스텐션이 시작할 때와 로그인 직후에 부른다.
// 응답 모양은 dante-extension 의 src/api/types.ts `Me` 와 맞춘다.
export async function GET(request: Request) {
  const token = await authenticateExtension(request);
  if (!token) return unauthorized();

  const { user } = token;
  return Response.json({
    userId: user.id,
    email: user.email,
    name: user.githubLogin,
  });
}
