import { prisma } from "@dante/db";
import { isSandboxConfigured, runTest, type RunRequest, type RunResult } from "@dante/sandbox";
import { installationToken } from "@/lib/github/pull-request";
import { runnerFramework, withPassThroughArgs } from "@/lib/notifications/runner-request";
import { detectRuntimeCommands } from "@/lib/projects/detect-runtime";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { resolveRuntimeSettings } from "@/lib/projects/runtime";

// 저장된 테스트 버전 하나를 격리 환경에서 돌린다 (서버 전용).
//
// PR 파이프라인의 runPullRequestTests(pr-test-run.ts)와 같은 조립을 쓰되, 대상이
// PR head 커밋이 아니라 "프로젝트 기본 브랜치 위에 이 버전 파일을 덮어쓴 것"이다.
// 결과는 TestRun 으로 남겨 세션 목록·상세가 다시 읽는다. 러너 자체는 main 것을 그대로.

/** 화면(세션 상세 터미널)이 쓰는 실행 결과 뷰. */
export type TestRunView = {
  status: "passed" | "failed" | "error";
  logs: string | null;
  errorMessage: string | null;
};

/** 실행조차 못 한 사전 오류(설정 문제). TestRun 으로 남기지 않는다 — 실행이 아니다. */
function preRunError(message: string): TestRunView {
  return { status: "error", logs: null, errorMessage: message };
}

/** 실행에 필요한 것을 모은 결과. 못 모으면 화면에 띄울 사유. */
export type RunTarget =
  | {
      ok: true;
      versionId: string;
      testFile: { path: string; content: string };
      framework: NonNullable<ReturnType<typeof runnerFramework>>;
      repo: NonNullable<Awaited<ReturnType<typeof getProjectRepo>>>;
      settings: ReturnType<typeof resolveRuntimeSettings>;
    }
  | { ok: false; view: TestRunView };

/**
 * 버전 하나를 돌리기 전에 필요한 것(소유 확인·버전·러너·레포·Runtime 설정)을 모은다.
 * 세션 상세의 실행(runTestVersion)과 폴더 보기의 실시간 실행이 같은 규칙을 쓴다.
 */
export async function loadRunTarget(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<RunTarget> {
  const fail = (message: string): RunTarget => ({ ok: false, view: preRunError(message) });

  const projectId = await getOwnedProjectId(projectRef, userId);
  if (!projectId) return fail("Project not found.");

  const version = await prisma.testFileVersion.findFirst({
    where: { id: versionId, testFile: { component: { projectId } } },
    select: {
      id: true,
      content: true,
      testFile: {
        select: {
          path: true,
          component: {
            select: {
              project: {
                select: {
                  testFramework: true,
                  installCommand: true,
                  testCommand: true,
                  testTimeoutMs: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!version) return fail("Session not found.");

  const settingsRow = version.testFile.component.project;
  const framework = runnerFramework(settingsRow.testFramework);
  if (!framework) {
    return fail("This project has no test framework set. Choose one in Settings → Runtime.");
  }
  if (!isSandboxConfigured()) {
    return fail("The test runner is not configured in this environment.");
  }

  const repo = await getProjectRepo(projectRef, userId);
  if (!repo) return fail("Project not found.");

  // Runtime 탭 값이 우선이고, 비어 있으면 레포에서 감지한 기본값으로 채운다(화면과 같은 규칙).
  const defaults = await detectRuntimeCommands(projectRef, repo, settingsRow.testFramework);
  const settings = resolveRuntimeSettings(settingsRow, defaults);

  return {
    ok: true,
    versionId: version.id,
    testFile: { path: version.testFile.path, content: version.content },
    framework,
    repo,
    settings,
  };
}

/** loadRunTarget 결과 → 러너 요청. 설치 토큰 발급은 여기서 한다(실패하면 부르는 쪽이 error 로 접는다). */
export async function buildRunRequest(
  target: Extract<RunTarget, { ok: true }>
): Promise<RunRequest> {
  const { repo, settings } = target;
  return {
    repo: {
      url: `https://github.com/${repo.repoOwner}/${repo.repoName}.git`,
      // 아직 커밋되지 않은 초안이라 기본 브랜치 위에서 이 파일만 덮어써 돌린다.
      revision: repo.defaultBranch,
      // private 레포 클론용. 1시간짜리라 runner 가 쓰고 버린다.
      token: await installationToken(repo.installationId),
    },
    testFiles: [target.testFile],
    framework: target.framework,
    commands: {
      install: settings.installCommand,
      test: withPassThroughArgs(settings.testCommand),
    },
    timeoutMs: settings.timeoutMs,
  };
}

/** 끝난 실행 1건을 남긴다. 세션 목록의 상태와 상세의 "최근 실행", 대시보드 지표가 여기서 나온다. */
export async function saveTestRun(versionId: string, result: RunResult) {
  await prisma.testRun.create({
    data: {
      testFileVersionId: versionId,
      status: result.status,
      exitCode: result.exitCode,
      logs: result.logs,
      errorMessage: result.errorMessage ?? null,
      startedAt: new Date(result.startedAt),
      finishedAt: new Date(result.finishedAt),
    },
  });
}

export async function runTestVersion(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<TestRunView> {
  const target = await loadRunTarget(projectRef, userId, versionId);
  if (!target.ok) return target.view;

  let result: RunResult;
  try {
    result = await runTest(await buildRunRequest(target));
  } catch (error) {
    // 러너에 닿지 못한 것도 "우리 쪽이 못 돌렸다"다. 러너가 돌려주는 error 와 같은 모양으로 접는다.
    const now = new Date().toISOString();
    result = {
      status: "error",
      exitCode: null,
      logs: "",
      errorMessage: error instanceof Error ? error.message : String(error),
      report: null,
      startedAt: now,
      finishedAt: now,
    };
  }

  await saveTestRun(target.versionId, result);

  return { status: result.status, logs: result.logs, errorMessage: result.errorMessage ?? null };
}
