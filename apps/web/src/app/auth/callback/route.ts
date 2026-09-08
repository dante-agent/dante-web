import { NextResponse } from "next/server";
import { LOGIN_PATH, safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// GitHub·Google 동의 → Supabase → 여기로 돌아온다.
// 받은 1회용 code 를 세션(쿠키)으로 바꾸는 곳. 회원가입/로그인 모두 이 경로를 탄다
// (해당 계정으로 처음 들어오면 Supabase 가 auth.users 에 새 사용자를 만든다).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  // 배포 환경에서는 로드밸런서 뒤에 있어 origin 이 내부 주소일 수 있다.
  // 그때는 원래 호스트가 x-forwarded-host 로 온다.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const baseUrl = !isLocal && forwardedHost ? `https://${forwardedHost}` : origin;

  // 사용자가 프로바이더 동의 화면에서 취소하면 code 대신 error 가 온다.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${baseUrl}${LOGIN_PATH}?error=denied`);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    // 브라우저가 심어둔 PKCE code_verifier 쿠키와 code 를 맞춰본다.
    // 성공하면 세션 쿠키가 응답에 실린다.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  // code 가 없거나 교환에 실패 — 만료된 링크, 새로고침으로 code 재사용 등.
  return NextResponse.redirect(`${baseUrl}${LOGIN_PATH}?error=exchange`);
}
