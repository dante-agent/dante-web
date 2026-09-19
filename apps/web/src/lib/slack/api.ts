// ⚠️ 서버 전용. Slack Web API 를 부르는 한 자리.
//
// @slack/web-api 를 넣지 않는 이유: 쓰는 메서드가 몇 개뿐이고 모두 "POST 하나, JSON
// 하나"다 (몇 줄로 될 일은 직접 — AGENTS.md). 재시도·페이지네이션 같은 SDK 기능은
// 필요해지면 그때 여기에 붙인다.
//
// Slack 은 실패도 HTTP 200 으로 준다. 본문의 ok 가 false 면 error 에 코드가 온다
// ("channel_not_found", "not_in_channel" …). 이 코드를 번역하지 않고 그대로 들고
// 다닌다 — 검색하면 답이 나오는 말이라 화면·전달 로그에도 그대로 적는다.

const SLACK_API = "https://slack.com/api";

/**
 * 응답을 기다리는 상한. Slack 이 멈추면 PR 결과 전달(코멘트·체크)과 설정 화면이 같이 멈춘다.
 * Discord 웹훅과 같은 값이다(discord-send.ts).
 */
const TIMEOUT_MS = 10_000;

export class SlackApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string
  ) {
    super(code);
    this.name = "SlackApiError";
  }
}

/** 이 코드들은 토큰이 죽었다는 뜻이다. 다시 연결하기 전에는 무엇을 보내도 같은 답이 온다. */
const REVOKED_CODES = new Set(["token_revoked", "account_inactive", "invalid_auth", "not_authed"]);

export function isRevokedError(error: unknown) {
  return error instanceof SlackApiError && REVOKED_CODES.has(error.code);
}

/** 사람이 읽을 한 줄. Slack 오류면 코드, 아니면 메시지. */
export function slackErrorDetail(error: unknown) {
  if (error instanceof SlackApiError) return error.code;
  if (error instanceof Error && error.name === "TimeoutError") return "Slack did not answer";
  return error instanceof Error ? error.message : String(error);
}

type SlackResponse = { ok: boolean; error?: string };

/**
 * 봇 토큰으로 부르는 메서드. 인자는 폼으로 보낸다.
 *
 * JSON 본문은 쓰기 메서드(chat.postMessage 등)만 받는다. conversations.info 같은 조회
 * 메서드에 JSON 으로 보내면 인자를 못 읽어 invalid_arguments 를 내거나(info), 조용히
 * 기본값으로 돈다(list 가 types 를 무시하고 공개 채널만 준다). 폼은 모든 메서드가 받는다.
 */
export async function slackCall<T extends object>(
  method: string,
  token: string,
  args: Record<string, string | number | boolean | undefined> = {}
): Promise<T & SlackResponse> {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) form.set(key, String(value));
  }

  return parse<T>(
    method,
    await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  );
}

/** 토큰 없이 앱 자격(client_id·client_secret)을 폼에 싣는 메서드. oauth.v2.access 가 이렇다. */
export async function slackForm<T extends object>(
  method: string,
  form: Record<string, string>
): Promise<T & SlackResponse> {
  return parse<T>(
    method,
    await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  );
}

async function parse<T>(method: string, response: Response) {
  // 429(속도 제한)·5xx 는 본문이 JSON 이 아닐 수 있다. 상태 코드를 오류 코드로 쓴다.
  if (!response.ok) throw new SlackApiError(method, `http_${response.status}`);

  const data = (await response.json()) as T & SlackResponse;
  if (!data.ok) throw new SlackApiError(method, data.error ?? "unknown_error");
  return data;
}
