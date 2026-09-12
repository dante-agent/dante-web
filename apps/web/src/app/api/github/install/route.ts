import { NextResponse } from "next/server";
import { installationUrl } from "@/lib/github/app";
import {
  INSTALL_STATE_COOKIE,
  INSTALL_STATE_MAX_AGE,
  createInstallState,
} from "@/lib/github/state";
import { LOGIN_PATH, safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// GitHub App 설치 시작. "GitHub 연결" 버튼이 여기로 온다.
//
// 하는 일은 두 가지뿐이다: state 를 만들어 쿠키에 심고, GitHub 설치 화면으로 보낸다.
// 실제 "어떤 레포를 열어줄지"는 GitHub 화면에서 사용자가 고른다.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 비로그인이면 로그인 화면으로 보내되 여기로 돌아올 주소를 ?next 로 넘긴다.
  // 그냥 "/" 로 보내면 로그인 후 /projects 로 떨어져, 사용자가 "GitHub 연결" 을
  // 처음부터 다시 눌러야 한다. safeNext 로 한 번 걸러 오픈 리다이렉트를 막는다.
  if (!user) {
    const url = new URL(LOGIN_PATH, request.url);
    url.searchParams.set("next", safeNext(new URL(request.url).pathname));
    return NextResponse.redirect(url);
  }

  const state = createInstallState();
  const response = NextResponse.redirect(installationUrl(state));

  // cookies() 대신 응답에 직접 심는다 — 리다이렉트 응답에 확실히 실린다.
  response.cookies.set(INSTALL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // GitHub 에서 돌아오는 top-level 이동에도 쿠키가 실려야 한다
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INSTALL_STATE_MAX_AGE,
  });

  return response;
}
