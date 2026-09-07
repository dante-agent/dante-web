import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google 로그인을 마치면 Supabase 가 ?code=... 를 붙여 이 주소로 돌려보낸다.
// 하는 일은 하나 — 그 code 를 진짜 세션 쿠키로 바꾼다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Vercel 뒤에서는 request.url 의 origin 이 내부 주소라 사용자가 보는 주소와 다르다.
  // 로컬에서는 x-forwarded-host 가 없으므로 origin 을 그대로 쓴다.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const baseUrl =
    process.env.NODE_ENV === "development" || !forwardedHost ? origin : `https://${forwardedHost}`;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/auth/error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/auth/error`);
  }

  return NextResponse.redirect(`${baseUrl}/dashboard`);
}
