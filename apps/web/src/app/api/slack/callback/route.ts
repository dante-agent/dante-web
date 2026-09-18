import { NextResponse } from "next/server";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { getAuthUser } from "@/lib/auth/user";
import { matchesState } from "@/lib/github/state";
import { slackErrorDetail } from "@/lib/slack/api";
import { saveSlackInstallation } from "@/lib/slack/installation";
import {
  SLACK_STATE_COOKIE,
  exchangeSlackCode,
  slackRedirectUri,
  stateTeamId,
} from "@/lib/slack/oauth";
import { getTeamRole, isTeamId } from "@/lib/teams/access";

// Slack 승인이 끝나면 Slack 이 여기로 돌려보낸다 (Slack App 의 Redirect URL).
// 승인하면 ?code&state, 취소하면 ?error=access_denied&state 가 온다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const teamId = stateTeamId(state ?? "");

  const back = (params: Record<string, string>) => {
    const target = new URL(
      isTeamId(teamId) ? `/team/${teamId}/settings/slack` : "/projects",
      request.url
    );
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    const response = NextResponse.redirect(target);
    // 성공이든 실패든 state 는 1회용이다.
    response.cookies.delete(SLACK_STATE_COOKIE);
    return response;
  };

  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));

  // 1) 우리 사이트에서, 이 팀으로 시작한 연결인가. 팀 id 는 state 안에 있고 state 는 쿠키와 같아야 한다.
  const expected = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${SLACK_STATE_COOKIE}=`))
    ?.slice(SLACK_STATE_COOKIE.length + 1);

  if (!isTeamId(teamId) || !matchesState(state, expected)) return back({ error: "state" });

  // 2) Slack 화면에서 취소했다.
  if (url.searchParams.get("error")) return back({ error: "denied" });

  // 3) 승인 화면에 다녀오는 사이에 owner 가 아니게 됐을 수 있다. 다시 본다.
  if ((await getTeamRole(teamId, user.id)) !== "owner") return back({ error: "owner" });

  const code = url.searchParams.get("code");
  if (!code) return back({ error: "code" });

  try {
    const install = await exchangeSlackCode(code, slackRedirectUri(request.url));
    await saveSlackInstallation(teamId, user.id, install);
  } catch (error) {
    console.error("[slack] oauth callback failed", error);
    return back({ error: "exchange", detail: slackErrorDetail(error).slice(0, 100) });
  }

  return back({ connected: "1" });
}
