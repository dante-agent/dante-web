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
};

export function renderSlackMessage(input: SlackMessageInput) {
  const { run, repo, prNumber } = input;
  const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;
  const prUrl = prNumber === null ? null : `${repoUrl}/pull/${prNumber}`;

  const lines: string[] = [];
  if (input.test) {
    lines.push("_Test notification from Dante — sample results, nothing actually ran._");
  }
  lines.push(`*dante* · ${headline(input.event, run)}`);
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
    if (rest > 0) lines.push(`…and ${rest} more`);
  }

  if (input.event === "cannotFinish" && run.error) {
    lines.push("", escape(oneLine(run.error)));
  }

  const links: string[] = [];
  if (prUrl) links.push(link(prUrl, "Open the pull request"));
  if (run.detailUrl) links.push(link(run.detailUrl, "Open in Dante"));
  if (links.length > 0) lines.push("", links.join(" · "));

  return lines.join("\n");
}

function headline(event: SlackEventId, run: RunSummary) {
  const { total, failed } = run.totals;
  switch (event) {
    case "failed":
      return `${failed} of ${total} ${total === 1 ? "test" : "tests"} failed`;
    case "recovered":
      return `Fixed — all ${total} ${total === 1 ? "test passes" : "tests pass"} now`;
    case "passed":
      return `All ${total} ${total === 1 ? "test" : "tests"} passed`;
    case "cannotFinish":
      return "Dante couldn't finish this run";
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
