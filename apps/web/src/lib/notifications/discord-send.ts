import { prisma } from "@dante/db";
import {
  discordAction,
  discordOutcome,
  renderDiscordMessage,
  type DiscordOutcome,
} from "@/lib/notifications/discord";
import type { RunSummary } from "@/lib/notifications/run-summary";
import type { NotificationSettings } from "@/lib/notifications/settings";
import { loadDiscordWebhookUrl, recordDelivery } from "@/lib/notifications/store";

// ⚠️ 서버 전용. Discord 웹훅으로 실제로 보내는 쪽. 규칙은 discord.ts.
//
// deliver.ts 와 같은 규칙으로 던지지 않는다 — 실패는 전달 로그에 적고 끝낸다.
// Discord 가 준 오류 문장("Unknown Webhook")은 번역하지 않고 그대로 남긴다.

/** Discord 가 거절했을 때. message 는 Discord 가 준 문장 그대로다. */
export class DiscordError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(`${status} ${message}`);
  }
}

async function callWebhook(url: string, method: "POST" | "PATCH", content: string) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    // 테스트 이름·에러 문장에 @everyone 이 들어 있어도 아무도 부르지 않는다.
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    // 웹훅 URL 은 모양을 검사해 받았다. 리다이렉트를 따라가면 그 검사가 무의미해진다.
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new DiscordError(response.status, body?.message ?? response.statusText);
  }
  return (await response.json()) as { id: string };
}

/** 새 메시지. wait=true 여야 Discord 가 메시지 id 를 돌려준다(나중에 고칠 때 쓴다). */
export function postDiscordMessage(webhookUrl: string, content: string) {
  return callWebhook(`${webhookUrl}?wait=true`, "POST", content);
}

function editDiscordMessage(webhookUrl: string, messageId: string, content: string) {
  return callWebhook(`${webhookUrl}/messages/${messageId}`, "PATCH", content);
}

export function discordErrorDetail(error: unknown) {
  if (error instanceof DiscordError) return error.message;
  if (error instanceof Error && error.name === "TimeoutError") return "Discord did not answer";
  return error instanceof Error ? error.message : String(error);
}

type DiscordTarget = { projectId: string; repo: string; prNumber: number; prUrl: string };

/**
 * PR 실행 결과 하나를 Discord 로. deliver.ts 가 적용 범위 판정을 통과한 뒤 부른다.
 *
 * 생성·실행 단계마다 불리지만 끝난 결과만 보낸다(discordAction 의 "none").
 */
export async function deliverDiscord(
  target: DiscordTarget,
  run: RunSummary,
  settings: NotificationSettings
) {
  if (!settings.discordEnabled || !settings.discordWebhookSaved) return;

  const outcome = discordOutcome(run);
  const surface = await prisma.pullRequestSurface.findUnique({
    where: { projectId_prNumber: { projectId: target.projectId, prNumber: target.prNumber } },
    select: { discordMessageId: true, discordOutcome: true },
  });
  const action = discordAction(outcome, surface?.discordOutcome ?? null, settings.discordEvents);

  const log = (status: "ok" | "skipped" | "failed", detail: string) =>
    recordDelivery({
      projectId: target.projectId,
      surface: "discord",
      prNumber: target.prNumber,
      status,
      detail,
    });

  if (action.kind === "none" || outcome === null) return;
  if (action.kind === "skip") {
    await log("skipped", action.reason);
    return;
  }

  const webhookUrl = await loadDiscordWebhookUrl(target.projectId);
  if (!webhookUrl) {
    await log("failed", "The saved webhook URL could not be read. Paste it again.");
    return;
  }

  const content = renderDiscordMessage(run, {
    repo: target.repo,
    prNumber: target.prNumber,
    prUrl: target.prUrl,
    failedLimit: settings.prCommentFailedLimit,
    recovered: action.event === "recovered",
  });

  try {
    const messageId =
      action.kind === "edit" && surface?.discordMessageId
        ? await editOrPost(webhookUrl, surface.discordMessageId, content)
        : (await postDiscordMessage(webhookUrl, content)).id;

    await saveDiscordSurface(target, messageId, outcome);
    await log("ok", messageId === surface?.discordMessageId ? "updated" : "sent");
  } catch (error) {
    await log("failed", discordErrorDetail(error));
  }
}

/** 사람이 채널에서 메시지를 지웠으면 고칠 대상이 없다(404). 그때는 새로 보낸다. */
async function editOrPost(webhookUrl: string, messageId: string, content: string) {
  try {
    return (await editDiscordMessage(webhookUrl, messageId, content)).id;
  } catch (error) {
    if (!(error instanceof DiscordError) || error.status !== 404) throw error;
    return (await postDiscordMessage(webhookUrl, content)).id;
  }
}

async function saveDiscordSurface(
  target: DiscordTarget,
  discordMessageId: string,
  discordOutcome: DiscordOutcome
) {
  await prisma.pullRequestSurface.upsert({
    where: { projectId_prNumber: { projectId: target.projectId, prNumber: target.prNumber } },
    create: {
      projectId: target.projectId,
      prNumber: target.prNumber,
      discordMessageId,
      discordOutcome,
    },
    update: { discordMessageId, discordOutcome },
  });
}
