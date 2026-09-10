import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";

// 깃허브 연결.
//
// 다음 PR 에서 채운다. 읽을 것은 이미 있다 — lib/github/connection.ts 가
// GithubInstallation(설치 정지·삭제)과 Project(레포 하나만 끊김) 두 곳에
// 흩어진 상태를 하나로 접어준다.
export default function ProjectGithubPage() {
  return (
    <>
      <SettingsHeader
        title="GitHub"
        description="The repository this project reads, and the App installation that grants access to it."
      />

      <ComingSoon>
        Installation status, the connected repository, and a way back to GitHub when access is
        suspended or the repo was removed from the installation.
      </ComingSoon>
    </>
  );
}
