import type { Metadata } from "next";
import { prisma } from "@dante/db";
import { StatusBadge } from "@/components/settings/notifications/controls";
import { SettingsHeader } from "@/components/settings/settings-section";
import { DisconnectSlackForm } from "@/components/settings/team/slack-forms";
import { buttonVariants } from "@/components/ui/button";
import { slackConfigured } from "@/lib/slack/oauth";
import { requireTeamMember } from "@/lib/teams/access";

// 팀의 Slack 워크스페이스 연결. 사람당·프로젝트당이 아니라 팀당 한 번이다.
// 어느 채널로 무엇을 보낼지는 프로젝트 알림 설정이 정한다 (docs/notifications-slack.md §2).

/** 콜백·시작 라우트가 ?error= 로 돌려보내는 사유. 모르는 값은 일반 문구로. */
const ERRORS: Record<string, string> = {
  owner: "Only team owners can connect Slack.",
  config:
    "Slack isn't set up on this server yet. SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are empty.",
  state: "The connection took too long or started somewhere else. Try again.",
  denied: "Slack wasn't connected — the request was cancelled on Slack.",
  code: "Slack didn't send an authorization code. Try again.",
  exchange: "Slack refused the connection.",
};

export const metadata: Metadata = { title: "Slack" };

export default async function TeamSlackPage({
  params,
  searchParams,
}: PageProps<"/team/[teamId]/settings/slack">) {
  const { teamId } = await params;
  const query = await searchParams;

  // 레이아웃에서 이미 확인했지만 페이지도 각자 확인한다 (AGENTS.md).
  const { role } = await requireTeamMember(teamId);
  const installation = await prisma.slackInstallation.findUnique({
    where: { teamId },
    select: {
      slackTeamName: true,
      revokedAt: true,
      createdAt: true,
      updatedAt: true,
      installedBy: { select: { githubLogin: true, email: true } },
    },
  });

  const isOwner = role === "owner";
  const errorCode = typeof query.error === "string" ? query.error : null;
  const errorDetail = typeof query.detail === "string" ? query.detail : null;
  const connectHref = `/api/slack/install?teamId=${teamId}`;

  return (
    <>
      <SettingsHeader
        title="Slack"
        description="Connect a Slack workspace once for the whole team. Each project then picks the channel it posts to in its notification settings."
      />

      {errorCode && (
        <StatusBadge
          tone="error"
          title={ERRORS[errorCode] ?? "Slack couldn't be connected."}
          // Slack 오류 코드는 번역하지 않는다. 검색하면 답이 나오는 말이다.
          description={errorDetail ? `Slack said: ${errorDetail}` : ""}
        />
      )}

      {installation?.revokedAt && (
        <StatusBadge
          tone="error"
          title="The Slack connection was lost"
          description="The Dante app was removed from the workspace or its token was revoked. Notifications stop until it's connected again."
          action={isOwner ? { label: "Reconnect", href: connectHref } : undefined}
        />
      )}

      <section className="border-border bg-card mt-8 max-w-2xl border p-5">
        {installation ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
                Workspace
              </p>
              <p className="mt-2 truncate text-[15px] leading-snug font-medium">
                {installation.slackTeamName}
              </p>
              <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                Connected
                {installation.installedBy &&
                  ` by ${installation.installedBy.githubLogin ?? installation.installedBy.email}`}{" "}
                on {installation.updatedAt.toISOString().slice(0, 10)}.
              </p>
            </div>
            {isOwner && (
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={connectHref}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "rounded-[4px]",
                  })}
                >
                  Reconnect
                </a>
                <DisconnectSlackForm teamId={teamId} />
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-[15px] leading-snug font-medium">No workspace connected</h2>
            <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
              {isOwner
                ? "Dante posts to public channels without being invited. For a private channel, invite @dante to it after connecting."
                : "Only team owners can connect Slack."}
            </p>
            {isOwner &&
              (slackConfigured() ? (
                <a
                  href={connectHref}
                  className={buttonVariants({ size: "sm", className: "mt-4 rounded-[4px]" })}
                >
                  Connect Slack
                </a>
              ) : (
                <p className="text-muted-foreground mt-4 text-[13px]">{ERRORS.config}</p>
              ))}
          </>
        )}
      </section>
    </>
  );
}
