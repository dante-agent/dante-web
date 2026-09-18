import type { NotificationLocale } from "@/lib/notifications/locale";
import type { RunSummary } from "@/lib/notifications/run-summary";
import type { SlackEventId } from "@/lib/notifications/settings";

// Slack 메시지 본문 (docs/notifications-slack.md §5.1). 순수 함수다.
//
// 한 덩어리 mrkdwn 이다. Block Kit 은 버튼이 필요해질 때 간다 — 지금 필요한 건
// "무엇이 깨졌고 어디로 가면 되는가" 뿐이다.
//
// 첫 줄에 레포와 PR 번호를 넣는다. Slack 을 보는 사람은 그 PR 을 보고 있지 않다.
// GitHub 코멘트에서는 생략해도 되는 맥락이 여기서는 필수다.

export type SlackMessageInput = {
  event: SlackEventId;
  run: RunSummary;
  repo: { owner: string; name: string };
  /** 테스트 알림은 null. 그때는 레포로 링크한다 — 아무 PR 번호나 적으면 남의 PR 로 간다 */
  prNumber: number | null;
  /** 실패 목록에 적을 최대 개수. PR 코멘트 설정(prCommentFailedLimit)을 같이 쓴다 */
  failedLimit: number;
  /** 설정 화면의 "테스트 알림". 진짜 실패로 오해하지 않게 맨 위에 밝힌다 */
  test?: boolean;
  /** 우리가 쓰는 문장의 언어. 테스트 이름·실패 사유·run.error 는 원문 그대로 둔다 (discord.ts 와 같다) */
  locale: NotificationLocale;
};

/** 메시지에 들어가는 문장 전부. discord.ts 의 COPY 와 같은 이유로 표 하나로 둔다. */
const COPY: Record<
  NotificationLocale,
  {
    test: string;
    failed: (failed: number, total: number) => string;
    recovered: (total: number) => string;
    passed: (total: number) => string;
    cannotFinish: string;
    more: (rest: number) => string;
    openPullRequest: string;
    openInDante: string;
  }
> = {
  en: {
    test: "Test notification from Dante — sample results, nothing actually ran.",
    failed: (failed, total) => `${failed} of ${total} ${total === 1 ? "test" : "tests"} failed`,
    recovered: (total) => `Fixed — all ${total} ${total === 1 ? "test passes" : "tests pass"} now`,
    passed: (total) => `All ${total} ${total === 1 ? "test" : "tests"} passed`,
    cannotFinish: "Dante couldn't finish this run",
    more: (rest) => `…and ${rest} more`,
    openPullRequest: "Open the pull request",
    openInDante: "Open in Dante",
  },
  ko: {
    test: "Dante 테스트 알림입니다 — 표본 결과이고, 실제로 실행된 것은 없습니다.",
    failed: (failed, total) => `테스트 ${total}개 중 ${failed}개 실패`,
    recovered: (total) => `복구됨 — 이제 테스트 ${total}개 모두 통과`,
    passed: (total) => `테스트 ${total}개 모두 통과`,
    cannotFinish: "Dante 가 실행을 끝내지 못했습니다",
    more: (rest) => `…외 ${rest}개`,
    openPullRequest: "PR 열기",
    openInDante: "Dante 에서 보기",
  },
};

export function renderSlackMessage(input: SlackMessageInput) {
  const { run, repo, prNumber } = input;
  const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;
  const prUrl = prNumber === null ? null : `${repoUrl}/pull/${prNumber}`;
  const copy = COPY[input.locale];

  const lines: string[] = [];
  if (input.test) {
    lines.push(`_${copy.test}_`);
  }
  lines.push(`*dante* · ${headline(input.event, run, copy)}`);
  lines.push(
    prUrl
      ? link(prUrl, `${repo.owner}/${repo.name} #${prNumber}`)
      : link(repoUrl, `${repo.owner}/${repo.name}`)
  );

  if (input.event === "failed" && run.failures.length > 0) {
    lines.push("");
    for (const failure of run.failures.slice(0, input.failedLimit)) {
      const reason = failure.message ? ` — ${escape(oneLine(failure.message))}` : "";
      lines.push(`• \`${escape(failure.file)}\` › ${escape(failure.name)}${reason}`);
    }
    const rest = run.failures.length - input.failedLimit;
    if (rest > 0) lines.push(copy.more(rest));
  }

  if (input.event === "cannotFinish" && run.error) {
    lines.push("", escape(oneLine(run.error)));
  }

  const links: string[] = [];
  if (prUrl) links.push(link(prUrl, copy.openPullRequest));
  if (run.detailUrl) links.push(link(run.detailUrl, copy.openInDante));
  if (links.length > 0) lines.push("", links.join(" · "));

  return lines.join("\n");
}

function headline(event: SlackEventId, run: RunSummary, copy: (typeof COPY)[NotificationLocale]) {
  const { total, failed } = run.totals;
  switch (event) {
    case "failed":
      return copy.failed(failed, total);
    case "recovered":
      return copy.recovered(total);
    case "passed":
      return copy.passed(total);
    case "cannotFinish":
      return copy.cannotFinish;
  }
}

/** Slack mrkdwn 링크. 라벨의 < > 가 링크 문법을 깨지 않게 이스케이프한다. */
function link(url: string, label: string) {
  return `<${url}|${escape(label)}>`;
}

/**
 * Slack 이 제어 문자로 읽는 세 글자. 테스트 이름에 `<Button>` 이 들어가면 그대로
 * 두면 링크로 읽힌다 (api.slack.com/reference/surfaces/formatting#escaping).
 */
function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** assertion 메시지는 여러 줄일 수 있다. 목록 한 줄에 담기게 첫 줄만, 너무 길면 자른다. */
function oneLine(text: string) {
  const first = text.split("\n")[0]?.trim() ?? "";
  return first.length > 200 ? `${first.slice(0, 199)}…` : first;
}
