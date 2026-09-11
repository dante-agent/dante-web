import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { RuntimeForm } from "@/components/settings/runtime/runtime-form";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";
import { defaultCommands, resolveRuntimeSettings } from "@/lib/projects/runtime";

// 실행 환경 — 테스트를 어디서 어떻게 돌리나.
//
// 여기 저장한 값을 runner 가 샌드박스에서 그대로 실행한다
// (docs/adr/0001-test-runtime.md). 받을 곳이 생긴 뒤에 폼을 열었다 — 그 전에
// 만들었으면 저장만 되고 아무도 읽지 않는 설정이 됐다.
export default async function ProjectRuntimePage({
  params,
}: PageProps<"/project/[projectRef]/settings/runtime">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 권한 검사는 앱 코드에서 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: {
      testFramework: true,
      installCommand: true,
      testCommand: true,
      testTimeoutMs: true,
    },
  });
  if (!project) notFound();

  return (
    <>
      <SettingsHeader
        title="Runtime"
        description="Where generated tests actually run — the commands the sandbox runs after cloning your repository, and how long it may take."
      />

      <RuntimeForm
        projectRef={projectRef}
        initial={resolveRuntimeSettings(project)}
        placeholders={defaultCommands(project.testFramework)}
      />

      <ComingSoon>
        Node version and environment variables. The version is better read from the
        <span className="font-mono"> .nvmrc </span>
        already in your repository than picked again here, and variables need the same encrypted
        storage the API keys use.
      </ComingSoon>
    </>
  );
}
