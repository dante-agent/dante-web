import { slackForm } from "@/lib/slack/api";

// ⚠️ 서버 전용. Slack 워크스페이스를 팀에 붙이는 OAuth (docs/notifications-slack.md §3).
//
//   팀 설정 "Connect Slack" → /api/slack/install → slack.com 승인 화면
//     → /api/slack/callback?code&state → oauth.v2.access (code → 봇 토큰) → 저장
//
// state 는 GitHub 설치와 같은 방식이다(lib/github/state.ts). 난수를 쿠키에 심고
// 같은 값을 Slack 에 실어 보낸 뒤, 돌아온 값이 쿠키와 같은지 본다. 여기에 팀 id 를
// 같이 싣는다 — 콜백이 어느 팀에 붙일지 알아야 하는데, 쿠키와 대조하므로 남이
// 팀 id 만 바꾼 링크를 만들어도 통하지 않는다.

/**
 * 봇 토큰 scope. 늘리면 이미 연결한 팀은 다시 승인해야 한다.
 *
 * chat:write.public 이 없으면 채널마다 /invite @dante 를 해야 하고, 그걸 잊은 채로
 * "왜 안 와요"가 된다. 비공개 채널은 이 scope 로도 안 되므로 초대가 필요하다.
 */
export const SLACK_SCOPES = ["chat:write", "chat:write.public", "channels:read", "groups:read"];

export const SLACK_STATE_COOKIE = "dante_slack_state";

function clientId() {
  return process.env.SLACK_CLIENT_ID ?? "";
}

function clientSecret() {
  return process.env.SLACK_CLIENT_SECRET ?? "";
}

/** 환경변수가 없으면 연결 버튼 대신 안내를 띄운다. 눌러서 Slack 오류 화면을 보는 것보다 낫다. */
export function slackConfigured() {
  return clientId() !== "" && clientSecret() !== "";
}

/**
 * Slack App 설정의 Redirect URL 과 글자 하나까지 같아야 한다.
 *
 * 기본은 요청 주소의 origin 이다. 로컬에서 터널(https)로 받는데 Next 가 요청을
 * localhost 로 보는 경우처럼 origin 이 어긋나면 SLACK_REDIRECT_URL 로 못박는다.
 */
export function slackRedirectUri(requestUrl: string) {
  return process.env.SLACK_REDIRECT_URL || new URL("/api/slack/callback", requestUrl).toString();
}

export function slackAuthorizeUrl(state: string, redirectUri: string) {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("scope", SLACK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** state = "<teamId>.<난수>". 난수는 base64url 이라 점이 없다. */
export function slackState(teamId: string, nonce: string) {
  return `${teamId}.${nonce}`;
}

export function stateTeamId(state: string) {
  return state.split(".")[0] ?? "";
}

type AccessResponse = {
  access_token: string;
  scope: string;
  bot_user_id: string;
  team: { id: string; name: string };
};

/** 승인 코드를 봇 토큰으로 바꾼다. 코드는 1회용이고 10분 안에 써야 한다. */
export async function exchangeSlackCode(code: string, redirectUri: string) {
  const data = await slackForm<AccessResponse>("oauth.v2.access", {
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri,
  });

  return {
    botToken: data.access_token,
    botUserId: data.bot_user_id,
    scopes: data.scope.split(",").filter(Boolean),
    slackTeamId: data.team.id,
    slackTeamName: data.team.name,
  };
}
