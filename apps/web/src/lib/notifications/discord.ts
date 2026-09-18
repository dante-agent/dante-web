import type { NotificationLocale } from "@/lib/notifications/locale";
import type { RunSummary } from "@/lib/notifications/run-summary";

// Discord 알림의 규칙. 서버·클라이언트 양쪽에서 읽으므로 DB 도 fetch 도 부르지 않는다
// (설정 화면이 이벤트 목록을 이 파일에서 가져간다). 보내는 쪽은 discord-send.ts.
//
// 기본값과 "언제 보내고 언제 고치나"는 docs/notifications-slack.md §4·§5 를 따른다.
// Discord 는 연결 방식(웹훅 URL 하나)만 다르고, 밀어내는 표면이라는 성격은 같다.

export type DiscordEventId = "failed" | "recovered" | "passed" | "cannotFinish";

export type DiscordEvents = Record<DiscordEventId, boolean>;

/** 설정 화면이 그대로 훑어 쓰는 목록. 순서 = 화면에 보이는 순서. */
export const DISCORD_EVENTS: { id: DiscordEventId; label: string; hint?: string }[] = [
  { id: "failed", label: "Tests failed" },
  {
    id: "recovered",
    label: "Fixed after a failure",
    hint: "The first passing run after a failure",
  },
  { id: "passed", label: "Everything passed", hint: "Can be noisy — every push sends one" },
  { id: "cannotFinish", label: "Dante could not finish", hint: "Our side broke, not your tests" },
];

/** 통과만 끈다. 켜 두면 하루에 수십 번 울려 채널이 음소거된다. */
export const DEFAULT_DISCORD_EVENTS: DiscordEvents = {
  failed: true,
  recovered: true,
  passed: false,
  cannotFinish: true,
};

/** JSON 칸을 좁힌다. 없는 키는 기본값, 모르는 키는 버린다 (settings.ts 의 parseCommentFields 와 같다). */
export function parseDiscordEvents(value: unknown): DiscordEvents {
  const stored =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const events = { ...DEFAULT_DISCORD_EVENTS };
  for (const event of DISCORD_EVENTS) {
    const saved = stored[event.id];
    if (typeof saved === "boolean") events[event.id] = saved;
  }
  return events;
}

/**
 * 받을 수 있는 웹훅 URL 인지.
 *
 * 서버가 이 URL 로 요청을 보내므로 Discord 가 아닌 주소를 받으면 우리 서버를 남의
 * 내부망으로 가는 통로로 쓰게 된다. 호스트와 경로를 모양째로 고정한다.
 */
const WEBHOOK_URL =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/;

export function isDiscordWebhookUrl(value: string) {
  return WEBHOOK_URL.test(value);
}

/** 한 번의 실행이 Discord 쪽에서 무엇이었나. 진행 중·할 일 없음은 null — 보내지 않는다. */
export type DiscordOutcome = "failed" | "passed" | "error";

export function discordOutcome(run: RunSummary): DiscordOutcome | null {
  if (run.status === "failed") return "error";
  if (run.status !== "completed") return null;
  return run.totals.failed > 0 ? "failed" : "passed";
}

export type DiscordAction =
  | { kind: "post" | "edit"; event: DiscordEventId }
  | { kind: "skip"; reason: string }
  | { kind: "none" };

/**
 * 보낼지, 고칠지, 넘길지.
 *
 * 같은 결과가 이어지면 새로 보내지 않고 직전 메시지를 고친다 — 푸시마다 "또 실패"가
 * 쌓이면 채널이 같은 소식으로 찬다. 결과가 바뀌면 새로 보낸다. 고치기만 하면 알림이
 * 울리지 않아 "고쳐졌다"를 아무도 모른다.
 *
 * "none" 은 전달 로그에도 남기지 않는 경우다(진행 중 상태). 생성·실행 단계마다
 * 불리므로 여기서 skipped 를 적으면 로그가 그것으로 찬다.
 */
export function discordAction(
  outcome: DiscordOutcome | null,
  previous: string | null,
  events: DiscordEvents
): DiscordAction {
  if (outcome === null) return { kind: "none" };

  const event: DiscordEventId =
    outcome === "error"
      ? "cannotFinish"
      : outcome === "failed"
        ? "failed"
        : previous === "failed"
          ? "recovered"
          : "passed";

  if (!events[event]) return { kind: "skip", reason: `${event} is turned off` };
  return { kind: previous === outcome ? "edit" : "post", event };
}

/**
 * 메시지에 들어가는 문장 전부. 번역 라이브러리를 들일 만큼 많지 않아 표 하나로 둔다.
 *
 * 테스트 이름·실패 사유·Dante 오류 문장(run.error)은 번역하지 않는다. 원문이어야
 * 검색해서 답을 찾을 수 있다.
 */
const COPY: Record<
  NotificationLocale,
  {
    test: string;
    fixed: string;
    couldNotFinish: string;
    failed: (failed: number, total: number) => string;
    passed: (total: number) => string;
    more: (rest: number) => string;
    openPullRequest: string;
    openInDante: string;
  }
> = {
  en: {
    test: "Test notification from Dante settings. Nothing actually ran.",
    fixed: "fixed — ",
    couldNotFinish: "could not finish",
    failed: (failed, total) => `${failed} of ${total} tests failed`,
    passed: (total) => `all ${total} tests passed`,
    more: (rest) => `…and ${rest} more`,
    openPullRequest: "Open the pull request",
    openInDante: "Open in Dante",
  },
  ko: {
    test: "Dante 설정에서 보낸 테스트 알림입니다. 실제로 실행된 것은 없습니다.",
    fixed: "복구됨 — ",
    couldNotFinish: "실행을 끝내지 못했습니다",
    failed: (failed, total) => `테스트 ${total}개 중 ${failed}개 실패`,
    passed: (total) => `테스트 ${total}개 모두 통과`,
    more: (rest) => `…외 ${rest}개`,
    openPullRequest: "PR 열기",
    openInDante: "Dante 에서 보기",
  },
};

/** Discord 메시지 본문 상한. 넘으면 400 이 난다. */
const CONTENT_LIMIT = 2000;

/**
 * 메시지 본문.
 *
 * 첫 줄에 레포와 PR 번호를 넣는다. Discord 를 보는 사람은 그 PR 을 보고 있지 않다.
 * 실패 목록은 GitHub 코멘트와 같은 개수(prCommentFailedLimit)까지만 — 전체는 코멘트에
 * 있고, 여기는 "가서 봐야 할 이유"를 주는 자리다.
 *
 * 링크는 <> 로 감싸 미리보기 카드를 끈다. 링크 둘이 카드 둘로 펼쳐지면 본문이 묻힌다.
 */
export function renderDiscordMessage(
  run: RunSummary,
  context: {
    repo: string;
    prNumber: number | null;
    prUrl: string | null;
    failedLimit: number;
    locale: NotificationLocale;
    /** 직전이 실패였던 통과. 제목으로 구분하지 않으면 그냥 통과와 똑같이 읽힌다 */
    recovered?: boolean;
    test?: boolean;
  }
) {
  const copy = COPY[context.locale];
  const lines: string[] = [];
  if (context.test) lines.push(`-# ${copy.test}`);

  lines.push(`**dante · ${context.recovered ? copy.fixed : ""}${headline(run, copy)}**`);
  lines.push(context.prNumber === null ? context.repo : `${context.repo} #${context.prNumber}`);

  if (run.status === "failed" && run.error) lines.push("", run.error);

  if (run.failures.length > 0) {
    lines.push("");
    for (const failure of run.failures.slice(0, context.failedLimit)) {
      const reason = failure.message ? ` — ${failure.message}` : "";
      lines.push(`- \`${failure.file}\` › ${failure.name}${reason}`);
    }
    const rest = run.failures.length - context.failedLimit;
    if (rest > 0) lines.push(copy.more(rest));
  }

  const links = [
    context.prUrl && `[${copy.openPullRequest}](<${context.prUrl}>)`,
    run.detailUrl && `[${copy.openInDante}](<${run.detailUrl}>)`,
  ].filter(Boolean);
  if (links.length > 0) lines.push("", links.join(" · "));

  const content = lines.join("\n");
  return content.length <= CONTENT_LIMIT ? content : `${content.slice(0, CONTENT_LIMIT - 1)}…`;
}

function headline(run: RunSummary, copy: (typeof COPY)[NotificationLocale]) {
  if (run.status === "failed") return copy.couldNotFinish;
  const { total, failed } = run.totals;
  if (failed > 0) return copy.failed(failed, total);
  return copy.passed(total);
}
