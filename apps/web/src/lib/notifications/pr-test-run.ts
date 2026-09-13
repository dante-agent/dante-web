import { installationToken } from "@/lib/github/pull-request";
import type { GeneratedPullRequestTest } from "@/lib/notifications/pr-test-generation";
import {
  callRunner,
  isRunnerConfigured,
  type RunnerResult,
} from "@/lib/notifications/runner-client";
import { runnerFramework, withPassThroughArgs } from "@/lib/notifications/runner-request";
import { detectRuntimeCommands } from "@/lib/projects/detect-runtime";
import { resolveRuntimeSettings } from "@/lib/projects/runtime";

// ⚠️ 서버 전용. PR 에서 만든 테스트를 PR head 커밋 위에서 runner 로 돌린다.

export type PullRequestTestRun =
  | { kind: "ran"; result: RunnerResult }
  /** 돌리지 않았다. reason 은 로그·코멘트용 */
  | { kind: "not-run"; reason: "no-tests" | "no-framework" | "runner-not-configured" };

export async function runPullRequestTests(args: {
  project: {
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
  headSha: string;
  tests: GeneratedPullRequestTest[];
  /** 끊으면 runner 요청을 닫는다. 결과는 error 로 접히니 호출자가 signal 을 보고 버린다 */
  signal?: AbortSignal;
}): Promise<PullRequestTestRun> {
  const { project } = args;
  if (args.tests.length === 0) return { kind: "not-run", reason: "no-tests" };

  // 러너를 모르면 리포트 플래그를 고를 수 없다. 생성 프롬프트도 러너 지시 없이 나갔다.
  const framework = runnerFramework(project.testFramework);
  if (!framework) return { kind: "not-run", reason: "no-framework" };
  if (!isRunnerConfigured()) return { kind: "not-run", reason: "runner-not-configured" };

  // Runtime 탭에 저장한 값이 우선이고, 비어 있으면 화면과 같은 규칙으로 레포에서 기본값을 정한다.
  const defaults = await detectRuntimeCommands(project.ref, project, project.testFramework);
  const settings = resolveRuntimeSettings(project, defaults);

  try {
    const result = await callRunner(
      {
        repo: {
          url: `https://github.com/${project.repoOwner}/${project.repoName}.git`,
          revision: args.headSha,
          // private 레포 클론용. 1시간짜리라 runner 가 쓰고 버린다.
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
    // runner 에 닿지 못한 것도 "우리 쪽이 못 돌렸다"다. runner 가 돌려주는 error 와 같은 모양으로 접는다.
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
