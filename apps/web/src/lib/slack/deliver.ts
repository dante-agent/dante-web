import { prisma } from "@dante/db";
import type { RunSummary } from "@/lib/notifications/run-summary";
import type { NotificationSettings } from "@/lib/notifications/settings";
import { recordDelivery } from "@/lib/notifications/store";
import { SlackApiError, isRevokedError, slackErrorDetail } from "@/lib/slack/api";
import { postSlackMessage, updateSlackMessage } from "@/lib/slack/channels";
import { loadSlackConnection, markSlackRevoked } from "@/lib/slack/installation";
import { renderSlackMessage } from "@/lib/slack/message";
import { slackEventOf, slackPlan, type SlackThread } from "@/lib/slack/rules";

// ⚠️ 서버 전용. 실행 결과 하나를 Slack 에 보낸다. lib/notifications/deliver.ts 가 부른다.
//
// deliver.ts 와 같은 규칙으로 던지지 않는다. 실패는 전달 로그에 Slack 오류 코드 그대로
// 적는다 — not_in_channel 은 검색하면 답이 나오지만 "채널 오류"는 아무것도 알려주지 않는다.

type SlackProject = { id: string; teamId: string; repoOwner: string; repoName: string };

export async function deliverSlack(
  project: SlackProject,
  prNumber: number,
  run: RunSummary,
  settings: NotificationSettings
) {
  const channelId = settings.slackChannelId;
  if (!settings.slackEnabled || !channelId) return;

  const thread = await loadThread(project.id, prNumber);
  const outcome = slackEventOf(run, thread.lastEvent);
  // 진행 상태는 조용히 지나간다. 전달 로그에도 적지 않는다 — 실행마다 서너 줄씩 쌓인다.
  if (!outcome) return;

  const log = (status: "ok" | "skipped" | "failed", detail: string) =>
    recordDelivery({ projectId: project.id, surface: "slack", prNumber, status, detail });

  const plan = slackPlan(outcome, settings.slackEvents, channelId, thread);
  if (plan.kind === "skip") {
    // 보내지 않아도 결론은 적는다. 통과를 끈 채로 "실패 → 통과"가 오면 그다음 실패가
    // 복구 뒤의 새 실패인지 알아야 한다.
    await saveThread(project.id, prNumber, { slackLastEvent: outcome.conclusion });
    await log("skipped", plan.reason);
    return;
  }

  const connection = await loadSlackConnection(project.teamId);
  if (!connection) {
    await log("failed", "Slack is not connected for this team");
    return;
  }

  const text = renderSlackMessage({
    event: outcome.event,
    run,
    repo: { owner: project.repoOwner, name: project.repoName },
    prNumber,
    failedLimit: settings.prCommentFailedLimit,
  });
  const channel = `#${settings.slackChannelName ?? channelId}`;

  try {
    if (plan.kind === "update") {
      try {
        await updateSlackMessage(connection.botToken, { channel: channelId, ts: plan.ts, text });
        await saveThread(project.id, prNumber, { slackLastEvent: outcome.conclusion });
        await log("ok", `updated in ${channel}`);
        return;
      } catch (error) {
        // 사람이 메시지를 지웠다. 새로 보내 스레드를 다시 시작한다.
        if (!(error instanceof SlackApiError && error.code === "message_not_found")) throw error;
      }
    }

    const threadTs = plan.kind === "reply" ? plan.threadTs : undefined;
    const sent = await postSlackMessage(connection.botToken, {
      channel: channelId,
      text,
      threadTs,
      broadcast: Boolean(threadTs),
    });

    await saveThread(project.id, prNumber, {
      slackChannelId: channelId,
      slackThreadTs: threadTs ?? sent.ts,
      slackMessageTs: sent.ts,
      slackLastEvent: outcome.conclusion,
    });
    await log("ok", `${threadTs ? "replied in" : "posted to"} ${channel}`);
  } catch (error) {
    if (isRevokedError(error)) await markSlackRevoked(project.teamId);
    await log("failed", slackErrorDetail(error));
  }
}

async function loadThread(projectId: string, prNumber: number): Promise<SlackThread> {
  const row = await prisma.pullRequestSurface.findUnique({
    where: { projectId_prNumber: { projectId, prNumber } },
    select: {
      slackChannelId: true,
      slackThreadTs: true,
      slackMessageTs: true,
      slackLastEvent: true,
    },
  });

  return {
    channelId: row?.slackChannelId ?? null,
    threadTs: row?.slackThreadTs ?? null,
    messageTs: row?.slackMessageTs ?? null,
    lastEvent: row?.slackLastEvent ?? null,
  };
}

async function saveThread(
  projectId: string,
  prNumber: number,
  patch: {
    slackChannelId?: string;
    slackThreadTs?: string;
    slackMessageTs?: string;
    slackLastEvent: string;
  }
) {
  await prisma.pullRequestSurface.upsert({
    where: { projectId_prNumber: { projectId, prNumber } },
    create: { projectId, prNumber, ...patch },
    update: patch,
  });
}
