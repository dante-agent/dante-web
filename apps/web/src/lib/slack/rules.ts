import type { RunSummary } from "@/lib/notifications/run-summary";
import type { SlackEventId, SlackEvents } from "@/lib/notifications/settings";

// Slack 에 무엇을, 어떻게 보낼지 판정한다 (docs/notifications-slack.md §4·§5). 순수 함수다.
//
// 판정과 전송을 나눈 이유는 scope.ts 와 같다. "왜 Slack 이 안 왔지"의 답이 여기서
// 나오고, 그 답을 전달 로그에 그대로 적는다.

/** PR 에 저장해 두는 결론. recovered 는 결론이 아니라 passed 로 가는 변화라 따로 두지 않는다 */
export type SlackConclusion = "failed" | "passed" | "cannotFinish";

/**
 * 이번 실행이 어떤 소식인지. 소식이 아니면(진행 중·변경 없음·건너뜀) null.
 *
 * 진행 상태를 Slack 으로 보내지 않는다. 밀어내는 표면에 중간 상태를 보내면 PR 하나가
 * 사람을 네 번 부르고, 그 팀은 채널을 음소거한다.
 */
export function slackEventOf(
  run: RunSummary,
  previous: string | null
): { event: SlackEventId; conclusion: SlackConclusion } | null {
  if (run.status === "failed") return { event: "cannotFinish", conclusion: "cannotFinish" };
  if (run.status !== "completed" || run.totals.total === 0) return null;

  if (run.totals.failed > 0) return { event: "failed", conclusion: "failed" };
  return { event: previous === "failed" ? "recovered" : "passed", conclusion: "passed" };
}

/** 이 PR 에 이미 보낸 메시지. 없으면 전부 null */
export type SlackThread = {
  channelId: string | null;
  threadTs: string | null;
  messageTs: string | null;
  lastEvent: string | null;
};

export type SlackPlan =
  | { kind: "skip"; reason: string }
  /** 채널에 새 메시지. 이 PR 의 첫 소식이거나 채널이 바뀌었다 */
  | { kind: "post" }
  /** 같은 결론이 반복됐다. 마지막 메시지의 숫자만 고친다 — 알림은 울리지 않는다 */
  | { kind: "update"; ts: string }
  /** 결론이 바뀌었다. 첫 메시지의 스레드에 달고 채널에도 띄운다 — 사람이 알아야 하는 변화다 */
  | { kind: "reply"; threadTs: string };

export function slackPlan(
  outcome: { event: SlackEventId; conclusion: SlackConclusion },
  events: SlackEvents,
  channelId: string,
  thread: SlackThread
): SlackPlan {
  if (!events[outcome.event]) return { kind: "skip", reason: SKIP_REASON[outcome.event] };

  // 다른 채널로 바꿨으면 옛 스레드는 없는 것으로 친다. 새 채널에는 맥락이 없다.
  if (thread.channelId !== channelId || !thread.threadTs || !thread.messageTs) {
    return { kind: "post" };
  }

  if (thread.lastEvent === outcome.conclusion) return { kind: "update", ts: thread.messageTs };
  return { kind: "reply", threadTs: thread.threadTs };
}

const SKIP_REASON: Record<SlackEventId, string> = {
  failed: "failures are turned off",
  recovered: "fixes are turned off",
  passed: "passing runs are silent",
  cannotFinish: "Dante errors are turned off",
};
