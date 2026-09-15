import { isSandboxConfigured, runTest, type RunResult } from "@dante/sandbox";
import { installationToken } from "@/lib/github/pull-request";
import type { GeneratedPullRequestTest } from "@/lib/notifications/pr-test-generation";
import { runnerFramework, withPassThroughArgs } from "@/lib/notifications/runner-request";
import { detectRuntimeCommands } from "@/lib/projects/detect-runtime";
import { resolveRuntimeSettings } from "@/lib/projects/runtime";

// ⚠️ 서버 전용. PR 에서 만든 테스트를 PR head 커밋 위에서 샌드박스로 돌린다
// (packages/sandbox, docs/adr/0002-run-sandbox-from-web.md).

export type PullRequestTestRun =
  | { kind: "ran"; result: RunResult }
  /** 돌리지 않았다. reason 은 로그·코멘트용 */
  | { kind: "not-run"; reason: "no-tests" | "no-framework" | "runner-not-configured" };

type TestRunProject = {
  ref: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
  testFramework: string | null;
  installCommand: string | null;
  testCommand: string | null;
  testTimeoutMs: number | null;
};

/**
 * 돌리지 않을 이유가 있으면 그 이유. 없으면 null.
 *
 * 샌드박스를 띄우기 전에 따로 묻는 이유: 실행을 기다리게 할지 정하는 쪽이 "실제로 샌드박스를
 * 띄울 작업인가"를 먼저 알아야 한다. 못 돌릴 작업까지 기다리게 하면 다른 작업이 괜히 밀린다.
 */
export function testRunSkipReason(
  project: Pick<TestRunProject, "testFramework">,
  tests: GeneratedPullRequestTest[]
): Extract<PullRequestTestRun, { kind: "not-run" }>["reason"] | null {
  if (tests.length === 0) return "no-tests";
  // 러너를 모르면 리포트 플래그를 고를 수 없다. 생성 프롬프트도 러너 지시 없이 나갔다.
  if (!runnerFramework(project.testFramework)) return "no-framework";
  if (!isSandboxConfigured()) return "runner-not-configured";
  return null;
}

export async function runPullRequestTests(args: {
  project: TestRunProject;
  headSha: string;
  tests: GeneratedPullRequestTest[];
  /** 끊으면 샌드박스를 내린다. 결과는 error 로 접히니 호출자가 signal 을 보고 버린다 */
  signal?: AbortSignal;
}): Promise<PullRequestTestRun> {
  const { project } = args;
  const skip = testRunSkipReason(project, args.tests);
  const framework = runnerFramework(project.testFramework);
  if (skip || !framework) return { kind: "not-run", reason: skip ?? "no-framework" };

  try {
    // Runtime 탭에 저장한 값이 우선이고, 비어 있으면 화면과 같은 규칙으로 레포에서 기본값을 정한다.
    const defaults = await detectRuntimeCommands(project.ref, project, project.testFramework);
    const settings = resolveRuntimeSettings(project, defaults);

    const result = await runTest(
      {
        repo: {
          url: `https://github.com/${project.repoOwner}/${project.repoName}.git`,
          revision: args.headSha,
          // private 레포 클론용. 1시간짜리라 쓰고 버린다.
          token: await installationToken(project.installationId),
        },
        testFiles: args.tests.map((test) => ({ path: test.testPath, content: test.code })),
        framework,
        commands: {
          install: settings.installCommand,
          test: withPassThroughArgs(settings.testCommand),
        },
        timeoutMs: settings.timeoutMs,
      },
      args.signal
    );
    return { kind: "ran", result };
  } catch (error) {
    // runTest 는 샌드박스 쪽 실패를 error 결과로 접어 돌려준다. 여기 오는 것은 그 앞(토큰 발급,
    // 기본 커맨드 조회)의 실패다. 이것도 "우리 쪽이 못 돌렸다"라 같은 모양으로 접는다.
    const now = new Date().toISOString();
    return {
      kind: "ran",
      result: {
        status: "error",
        exitCode: null,
        logs: "",
        errorMessage: error instanceof Error ? error.message : String(error),
        report: null,
        startedAt: now,
        finishedAt: now,
      },
    };
  }
}
