import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";

// 알림 — 언제, 어디로 알릴지.
//
// Slack 은 두 층으로 나뉜다. 워크스페이스를 붙이는 OAuth 는 한 번만 하면 되는
// 일이라 팀 설정으로 갈 것이고(팀 모델이 아직 없다), 어느 채널로 무엇을 보낼지는
// 프로젝트마다 다르니 여기 남는다. GitHub 쪽(PR 코멘트·체크런)은 성격상 GitHub
// 페이지에 가깝지만, 알림을 끄러 오는 사람은 이 페이지를 먼저 열기 때문에 여기
// 둔다.
export default function ProjectNotificationsPage() {
  return (
    <>
      <SettingsHeader
        title="Notifications"
        description="Which events reach you, and where — a Slack channel, or a comment on the pull request."
      />

      <ComingSoon>
        Per-event switches for Slack and GitHub. Connecting the Slack workspace itself is a
        once-per-team step, so it moves to team settings when the team model lands; only the channel
        routing stays here.
      </ComingSoon>
    </>
  );
}
