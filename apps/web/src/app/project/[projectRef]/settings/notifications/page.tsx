import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { StatusBadge } from "@/components/settings/notifications/controls";
import { DeliveryLog } from "@/components/settings/notifications/delivery-log";
import { GithubNotificationsForm } from "@/components/settings/notifications/github-notifications-form";
import { NotificationScopeForm } from "@/components/settings/notifications/scope-form";
import { SnoozeBanner, SnoozeControl } from "@/components/settings/notifications/snooze";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";
import { checkRequiredStatus, installationClient } from "@/lib/github/pull-request";
import { danteLinks } from "@/lib/notifications/links";
import { SAMPLE_RUNS } from "@/lib/notifications/run-summary";
import { isSnoozed, toNotificationSettings } from "@/lib/notifications/settings";
import { notificationBadges } from "@/lib/notifications/status";
import { recentDeliveries } from "@/lib/notifications/store";

// 알림 — 언제, 어디로 알릴지.
//
// 지금은 GitHub 만 있다. Slack 은 두 층으로 나뉜다 — 워크스페이스를 붙이는
// OAuth 는 한 번만 하면 되는 일이라 팀 설정으로 갈 것이고(팀 모델이 아직 없다),
// 어느 채널로 무엇을 보낼지는 프로젝트마다 다르니 여기 남는다.
export default async function ProjectNotificationsPage({
  params,
}: PageProps<"/project/[projectRef]/settings/notifications">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 권한 검사는 앱 코드에서 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: {
      id: true,
      ref: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
      disconnectedAt: true,
      disconnectedReason: true,
      installation: { select: { suspendedAt: true, deletedAt: true } },
      notificationSetting: true,
    },
  });
  if (!project) notFound();

  const settings = toNotificationSettings(project.notificationSetting);

  const [badges, deliveries, requiredCheck] = await Promise.all([
    notificationBadges(project),
    recentDeliveries(project.id),
    requiredCheckStatus(project),
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
        description="Which events reach you, and where — a comment on the pull request, a check that can block the merge."
      />

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
      />

      <NotificationScopeForm
        projectRef={project.ref}
        defaultBranch={project.defaultBranch}
        initial={{ branchFilters: settings.branchFilters, skipDraftPr: settings.skipDraftPr }}
      />
      <SnoozeControl projectRef={project.ref} />

      <div className="mt-12 max-w-2xl">
        <ComingSoon>
          Slack, Discord and email. Connecting a Slack workspace is a once-per-team step, so it
          moves to team settings when the team model lands; only the channel routing stays here.
        </ComingSoon>
      </div>

      <DeliveryLog projectRef={project.ref} deliveries={deliveries} />
    </>
  );
}

/**
 * `dante` 가 required check 인지 확인한다.
 *
 * 화면을 그릴 때마다 GitHub 을 한 번 부른다. 실패해도 페이지는 떠야 하므로
 * (설치가 막 끊겼거나 GitHub 이 느릴 수 있다) 모르면 "unknown" 으로 둔다.
 */
async function requiredCheckStatus(project: {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
}) {
  try {
    const octokit = await installationClient(project.installationId);
    return await checkRequiredStatus(
      octokit,
      { owner: project.repoOwner, repo: project.repoName },
      project.defaultBranch
    );
  } catch {
    return "unknown" as const;
  }
}
