import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { ConnectionBanner } from "@/components/settings/github/connection-banner";
import { StatusBadge } from "@/components/settings/notifications/controls";
import { DeliveryLog } from "@/components/settings/notifications/delivery-log";
import { DiscordNotificationsForm } from "@/components/settings/notifications/discord-form";
import { GithubNotificationsForm } from "@/components/settings/notifications/github-notifications-form";
import { NotificationScopeForm } from "@/components/settings/notifications/scope-form";
import { SnoozeBanner } from "@/components/settings/notifications/snooze";
import { SlackNotificationsForm } from "@/components/settings/notifications/slack-notifications-form";
import { SnoozeControl } from "@/components/settings/notifications/snooze-control";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { installationSettingsUrl } from "@/lib/github/app";
import { connectionNotice, projectConnection } from "@/lib/github/connection";
import { cachedRepoLookup, repoLookupKey } from "@/lib/github/lookup-cache";
import { checkRequiredStatus, installationClient } from "@/lib/github/pull-request";
import { danteLinks } from "@/lib/notifications/links";
import { SAMPLE_RUNS } from "@/lib/notifications/run-summary";
import { isSnoozed, toNotificationSettings } from "@/lib/notifications/settings";
import { notificationBadges } from "@/lib/notifications/status";
import { recentDeliveries } from "@/lib/notifications/store";
import type { ProjectRepo } from "@/lib/projects/queries";
import { isRevokedError, slackErrorDetail } from "@/lib/slack/api";
import { listSlackChannels, type SlackChannel } from "@/lib/slack/channels";
import { loadSlackConnection, markSlackRevoked } from "@/lib/slack/installation";

/** 전달 로그의 재시도 서버 액션이 after() 로 PR 작업을 돈다. api/github/webhook/route.ts 와 같은 이유 */
export const maxDuration = 800;

// 알림 — 언제, 어디로 알릴지.
//
// GitHub·Discord·Slack. Discord 는 웹훅 URL 하나로 붙어 프로젝트에만 둔다. Slack 은 두 층으로
// 나뉜다 — 워크스페이스를 붙이는 OAuth 는 팀마다 한 번만 하면 되는 일이라 팀 설정
// (/team/<id>/settings/slack)에 붙이고, 어느 채널로 무엇을 보낼지는 프로젝트마다 다르니 여기 둔다.
export default async function ProjectNotificationsPage({
  params,
}: PageProps<"/project/[projectRef]/settings/notifications">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 권한 검사는 앱 코드에서 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: {
      id: true,
      ref: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
      teamId: true,
      disconnectedAt: true,
      disconnectedReason: true,
      installation: {
        select: {
          id: true,
          accountLogin: true,
          accountType: true,
          suspendedAt: true,
          deletedAt: true,
        },
      },
      notificationSetting: true,
    },
  });
  if (!project) notFound();

  const settings = toNotificationSettings(project.notificationSetting);

  // 연결이 끊긴 상태의 배너는 settings/github 과 같은 것을 쓴다. 문구도 다음
  // 행동도 lib/github/connection.ts 한 곳에만 있어야 한 번 고치면 두 화면이
  // 같이 고쳐진다.
  const notice = connectionNotice(projectConnection(project), {
    accountLogin: project.installation.accountLogin,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    installationSettingsUrl: installationSettingsUrl(project.installation),
    projectRef: project.ref,
  });

  // 배지가 전달 로그를 같이 쓰므로 한 번만 읽어 나눠 준다. Prisma 쿼리는 await 할 때
  // 실행되는 지연 객체라 Promise.resolve 로 한 번만 돌게 묶는다.
  const deliveriesQuery = Promise.resolve(recentDeliveries(project.id));
  const [badges, deliveries, requiredCheck, slack] = await Promise.all([
    deliveriesQuery.then((rows) => notificationBadges(project, rows)),
    deliveriesQuery,
    requiredCheckStatus(project),
    slackState(project.teamId),
  ]);

  // 미리보기 데이터. 실제 실행 결과가 생기면 여기서 가장 최근 것을 읽어 쓴다
  // (TestRun 모델은 테스트 생성 PR 에서 들어온다). 그때까지는 표본.
  const links = danteLinks(project.ref, 42);
  const samples = {
    failing: { ...SAMPLE_RUNS.failing, ...links },
    passing: { ...SAMPLE_RUNS.passing, ...links },
  };

  return (
    <>
      <SettingsHeader
        title="Notifications"
        description="Which events reach you, and where — a comment on the pull request, a check that can block the merge, a message in Discord."
      />

      {notice && <ConnectionBanner notice={notice} projectRef={project.ref} />}

      {settings.snoozedUntil && isSnoozed(settings) && (
        <SnoozeBanner projectRef={project.ref} until={settings.snoozedUntil} />
      )}

      {badges.map((badge) => (
        <StatusBadge key={badge.title} {...badge} />
      ))}

      <GithubNotificationsForm
        projectRef={project.ref}
        initial={settings}
        samples={samples}
        requiredCheck={requiredCheck}
        repoRulesUrl={`https://github.com/${project.repoOwner}/${project.repoName}/settings/rules`}
      />

      <NotificationScopeForm
        projectRef={project.ref}
        defaultBranch={project.defaultBranch}
        initial={{ branchFilters: settings.branchFilters, skipDraftPr: settings.skipDraftPr }}
      />
      <SnoozeControl projectRef={project.ref} />

      <div className="mt-12">
        <DiscordNotificationsForm projectRef={project.ref} initial={settings} />
      </div>

      <div className="mt-12">
        {slack.connected ? (
          <SlackNotificationsForm
            projectRef={project.ref}
            workspace={slack.workspace}
            channels={slack.channels}
            channelsError={slack.error}
            initial={settings}
          />
        ) : (
          <StatusBadge
            tone="warn"
            title={slack.revoked ? "The Slack connection was lost" : "Slack isn't connected"}
            description="A team owner connects a Slack workspace once in team settings. Then pick the channel for this project here."
            action={{ label: "Open team settings", href: `/team/${project.teamId}/settings/slack` }}
          />
        )}
      </div>

      <div className="mt-12 max-w-2xl">
        <ComingSoon>Email.</ComingSoon>
      </div>

      <DeliveryLog projectRef={project.ref} deliveries={deliveries} />
    </>
  );
}

/**
 * 팀의 Slack 연결과 채널 목록.
 *
 * 채널 목록을 못 받아도 페이지는 뜬다. 토큰이 죽었다는 답이면 그 자리에서 끊긴 것으로
 * 적는다 — 알림을 보내다 알게 될 때까지 기다리면 그사이 설정 화면이 멀쩡해 보인다.
 */
async function slackState(teamId: string) {
  const connection = await loadSlackConnection(teamId);
  if (!connection) {
    const revoked = await prisma.slackInstallation.count({ where: { teamId } });
    return { connected: false as const, revoked: revoked > 0 };
  }

  let channels: SlackChannel[] = [];
  let error: string | null = null;
  try {
    channels = await listSlackChannels(connection.botToken);
  } catch (caught) {
    if (isRevokedError(caught)) {
      await markSlackRevoked(teamId);
      return { connected: false as const, revoked: true };
    }
    error = slackErrorDetail(caught);
  }

  return { connected: true as const, workspace: connection.slackTeamName, channels, error };
}

/**
 * `dante` 가 required check 인지 확인한다.
 *
 * GitHub 을 부르되 결과는 몇 분 캐시한다(lib/github/lookup-cache.ts) — 알림
 * 설정을 저장하면 비워진다. 실패해도 페이지는 떠야 하므로 (설치가 막 끊겼거나
 * GitHub 이 느릴 수 있다) 모르면 "unknown" 으로 둔다. 실패는 캐시되지 않는다.
 */
async function requiredCheckStatus(project: ProjectRepo & { ref: string }) {
  try {
    return await cachedRepoLookup(
      "required-check",
      repoLookupKey(project.ref, project),
      async (key) =>
        checkRequiredStatus(
          await installationClient(Number(key.installationId)),
          { owner: key.owner, repo: key.repo },
          key.branch
        )
    );
  } catch {
    return "unknown" as const;
  }
}
