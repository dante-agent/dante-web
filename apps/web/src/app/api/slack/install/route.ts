import { NextResponse } from "next/server";
import { LOGIN_PATH, safeNext } from "@/lib/auth/redirect";
import { getAuthUser } from "@/lib/auth/user";
import { INSTALL_STATE_MAX_AGE, createInstallState } from "@/lib/github/state";
import { getTeamRole, isTeamId } from "@/lib/teams/access";
import {
  SLACK_STATE_COOKIE,
  slackAuthorizeUrl,
  slackConfigured,
  slackRedirectUri,
  slackState,
} from "@/lib/slack/oauth";

// Slack 연결 시작. 팀 설정의 "Connect Slack" 이 ?teamId= 를 붙여 여기로 온다.
//
// GitHub 설치 시작(api/github/install)과 같은 모양이다: state 를 쿠키에 심고
// Slack 승인 화면으로 보낸다. 팀 설정은 owner 만 바꾼다(팀 모델 결정 2).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId") ?? "";
  const user = await getAuthUser();

  if (!user) {
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("next", safeNext(`${url.pathname}${url.search}`));
    return NextResponse.redirect(login);
  }

  if (!isTeamId(teamId)) return NextResponse.redirect(new URL("/projects", request.url));

  const back = (error: string) =>
    NextResponse.redirect(new URL(`/team/${teamId}/settings/slack?error=${error}`, request.url));

  const role = await getTeamRole(teamId, user.id);
  if (!role) return NextResponse.redirect(new URL("/projects", request.url));
  if (role !== "owner") return back("owner");
  if (!slackConfigured()) return back("config");

  const state = slackState(teamId, createInstallState());
  const response = NextResponse.redirect(slackAuthorizeUrl(state, slackRedirectUri(request.url)));

  response.cookies.set(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // Slack 에서 돌아오는 top-level 이동에도 쿠키가 실려야 한다
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INSTALL_STATE_MAX_AGE,
  });

  return response;
}
