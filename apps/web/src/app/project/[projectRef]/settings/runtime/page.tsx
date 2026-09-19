import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { RuntimeForm } from "@/components/settings/runtime/runtime-form";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { detectRuntimeCommands } from "@/lib/projects/detect-runtime";
import { TEST_FRAMEWORKS, isTestFramework, type TestFrameworkId } from "@/lib/projects/frameworks";
import { resolveRuntimeSettings } from "@/lib/projects/runtime";

export const metadata: Metadata = { title: "Runtime settings" };

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
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: {
      testFramework: true,
      installCommand: true,
      testCommand: true,
      testTimeoutMs: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
    },
  });
  if (!project) notFound();

  // 기본값은 레포를 보고 정한다 — lockfile 로 패키지 매니저를, package.json 의
  // scripts.test 로 테스트 커맨드를. 못 읽으면 일반 기본값으로 떨어진다.
  const defaults = await detectRuntimeCommands(projectRef, project, project.testFramework);

  // 러너를 바꾸면 기본 테스트 명령도 바뀐다. 폼이 저장 전에 바뀔 값을 보여줄 수
  // 있게 러너마다 미리 구해 둔다. 레포 조회는 캐시돼 있어 GitHub 왕복은 늘지 않는다.
  const testDefaults = Object.fromEntries(
    await Promise.all(
      TEST_FRAMEWORKS.map(
        async (framework) =>
          [
            framework.id,
            (await detectRuntimeCommands(projectRef, project, framework.id)).test,
          ] as const
      )
    )
  ) as Record<TestFrameworkId, string>;

  return (
    <>
      <SettingsHeader
        title="Runtime"
        description="Where generated tests actually run — the commands the sandbox runs after cloning your repository, and how long it may take."
      />

      <RuntimeForm
        projectRef={projectRef}
        initial={resolveRuntimeSettings(project, defaults)}
        placeholders={defaults}
        testFramework={
          project.testFramework && isTestFramework(project.testFramework)
            ? project.testFramework
            : null
        }
        testDefaults={testDefaults}
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
