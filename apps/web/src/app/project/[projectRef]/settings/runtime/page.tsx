import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";

// 실행 환경 — 테스트를 어디서 어떻게 돌리나.
//
// 값을 받을 곳(apps/runner)이 아직 껍데기라 폼부터 만들면 저장만 되고 아무도
// 읽지 않는 설정이 된다. 실행 환경은 Vercel Sandbox 로 정해졌고
// (docs/adr/0001-test-runtime.md), runner 가 그걸 붙인 뒤에 채운다.
export default function ProjectRuntimePage() {
  return (
    <>
      <SettingsHeader
        title="Runtime"
        description="Where generated tests actually run — the runner image, the install and test commands, and the environment they see."
      />

      <ComingSoon>
        Node version, package manager, install/test commands, and environment variables. Waiting on
        the runner (<span className="font-mono">apps/runner</span>), which is still a shell.
      </ComingSoon>
    </>
  );
}
