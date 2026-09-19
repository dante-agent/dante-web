import { after } from "next/server";
import { Prisma, prisma } from "@dante/db";
import {
  fetchFileText,
  fetchPullRequestFiles,
  installationClient,
  type Octokit,
  type RepoRef,
} from "@/lib/github/pull-request";
import {
  changedComponentFiles,
  fileComponentName,
  type ChangedFile,
} from "@/lib/notifications/changed-components";
import { deliverRunSummary, type PullRequestContext } from "@/lib/notifications/deliver";
import { extractComponents } from "@/lib/notifications/extract-components";
import { danteLinks } from "@/lib/notifications/links";
import { checkPayer } from "@/lib/notifications/pr-author";
import { payerOutcome, type Payer } from "@/lib/notifications/pr-author-rules";
import {
  generatePullRequestTests,
  savePullRequestTests,
  type GeneratedPullRequestTest,
  type PullRequestSource,
} from "@/lib/notifications/pr-test-generation";
import {
  runPullRequestTests,
  testRunSkipReason,
  type PullRequestTestRun,
} from "@/lib/notifications/pr-test-run";
import { finalRun, type LocatedComponent } from "@/lib/notifications/run-result";
import { dispatchTestRuns } from "@/lib/notifications/test-run-queue";
import {
  parseRunInput,
  TEST_RUN_STALE_MS,
  type RunInput,
} from "@/lib/notifications/test-run-rules";
import { mapConcurrent } from "@/lib/map-concurrent";
import { packageDependencies } from "@/lib/projects/test-generation-prompt";
import { queuedRun, type RunSummary } from "@/lib/notifications/run-summary";

// ⚠️ 서버 전용.
//
// PR 한 커밋을 처리하는 작업. 웹훅은 작업을 적어 두고 바로 200 을 돌려주고,
// 실제 일(파일 읽기·추출·GitHub 에 쓰기)은 응답이 나간 뒤 `after()` 로 한다.
//
// 왜 옮겼나: GitHub 은 10초 안에 응답이 없으면 배달을 실패로 보고 재시도한다.
// 파일 읽기만으로 3~4초가 걸렸고, 테스트 생성·실행이 붙으면 분 단위가 된다.
//
// 왜 외부 큐가 아니라 after() 인가: 새 의존성·외부 서비스 없이 되고, Vercel 에서는
// waitUntil 로 응답 뒤에도 함수가 살아 있다. 대신 함수가 중간에 죽으면 자동 재시도가
// 없다. 그래서 작업 상태를 DB 에 적는다 — 멈춘 작업이 "running" 으로 남아 보이고,
// 체크의 Re-run 버튼으로 다시 돌릴 수 있다. 실행 시간 상한은 라우트의 maxDuration 이다.
//
// 생성과 샌드박스 실행은 다른 함수에서 돈다(docs/adr/0002-run-sandbox-from-web.md).
//   queued → running(생성) → awaiting_run → testing(샌드박스) → done / failed / superseded
// 샌드박스 실행은 같은 팀 안에서 하나씩이다. 차례는 test-run-queue.ts 가 정하고, 차례가 온 작업은
// api/internal/pr-test-run 이 새 함수에서 runQueuedTestRun 으로 돌린다.

/** 작업을 돌리는 데 필요한 프로젝트 쪽 사실. deliver.ts 의 NotifiableProject 와 같다. */
export type JobProject = {
  id: string;
  ref: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
  /** PR 작성자가 이 팀의 멤버인지 볼 때, 실행 차례를 팀마다 나눌 때 쓴다 */
  teamId: string;
  /** 생성 프롬프트의 러너 지시. 고르지 않았으면 null */
  testFramework: string | null;
  /** Runtime 탭에 저장한 값. null 이면 레포에서 기본값을 정한다(pr-test-run.ts) */
  installCommand: string | null;
  testCommand: string | null;
  testTimeoutMs: number | null;
};

/**
 * 생성 단계의 마감. 작업을 시작한 때부터 잰다.
 *
 * 라우트의 maxDuration(800초)에 잘리면 작업이 "running" 으로 남고 체크는 in_progress 로 돈다.
 * 그 전에 생성을 끝내고 남은 파일은 건너뛴다. 남는 시간(약 200초)은 웹훅 응답 전 처리와
 * 생성 뒤의 저장·결과 전달(코멘트·체크·Slack·Discord)에 쓴다.
 */
const GENERATION_DEADLINE_MS = 10 * 60 * 1000;

/** 실행 함수가 프로젝트를 DB 에서 다시 읽을 때. JobProject 와 같은 필드다 */
const JOB_PROJECT_SELECT = {
  id: true,
  ref: true,
  repoOwner: true,
  repoName: true,
  defaultBranch: true,
  installationId: true,
  teamId: true,
  testFramework: true,
  installCommand: true,
  testCommand: true,
  testTimeoutMs: true,
} satisfies Prisma.ProjectSelect;

/**
 * 작업을 적고 응답 뒤에 돌린다.
 *
 * 같은 커밋에 대한 작업은 하나다(projectId·prNumber·headSha). GitHub 이 같은 배달을
 * 다시 보내거나 Re-run 을 누르면 새로 만들지 않고 그 작업을 다시 queued 로 되돌린다.
 * 그 작업이 아직 돌고 있으면 아무것도 하지 않는다(claimJob).
 *
 * payer 는 AI 비용을 낼 사람이다. 푸시는 PR 작성자, Re-run 은 누른 사람을 넘긴다.
 */
export async function enqueuePullRequestJob(
  project: JobProject,
  pr: PullRequestContext,
  payer: Payer
) {
  const key = { projectId: project.id, prNumber: pr.number, headSha: pr.headSha };
  const jobId = await claimJob(key, new Date());
  if (!jobId) return;

  after(() => runPullRequestJob(jobId, project, pr, payer));
}

const IN_FLIGHT = ["queued", "running", "awaiting_run", "testing"];

/**
 * 같은 커밋의 작업을 queued 로 되돌리고 그 ID 를 돌려준다. 이미 돌고 있으면 null.
 *
 * 돌고 있는 작업을 또 돌리면 두 작업이 한 행을 같이 쓰면서 각자 GitHub 체크를 새로 만든다.
 * 실행과 마지막 결과 전달은 한 번뿐이라 나머지 체크는 영영 in_progress 로 남는다
 * (Re-run 을 연달아 누른 경우). 그래서 "돌고 있지 않을 때만 되돌린다" 를 UPDATE 한 번으로 한다 —
 * 읽고 나서 쓰면 동시에 누른 두 요청이 둘 다 "안 돈다" 를 본다.
 * 오래 멈춘 작업(함수가 죽음)은 돌고 있지 않은 것으로 본다. 기준은 죽은 실행 판정과 같다.
 */
async function claimJob(
  key: { projectId: string; prNumber: number; headSha: string },
  now: Date
): Promise<string | null> {
  const staleBefore = new Date(now.getTime() - TEST_RUN_STALE_MS);
  const updated = await prisma.pullRequestJob.updateManyAndReturn({
    where: {
      ...key,
      OR: [{ status: { notIn: IN_FLIGHT } }, { updatedAt: { lt: staleBefore } }],
    },
    data: {
      status: "queued",
      error: null,
      startedAt: null,
      finishedAt: null,
      runInput: Prisma.DbNull,
      runStartedAt: null,
    },
    select: { id: true },
  });
  if (updated.length > 0) return updated[0].id;

  try {
    const created = await prisma.pullRequestJob.create({
      data: { ...key, status: "queued" },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // 행이 이미 있다 = 위 UPDATE 가 건너뛴 돌고 있는 작업, 또는 동시에 온 요청이 방금 만든 작업.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

async function runPullRequestJob(
  jobId: string,
  project: JobProject,
  pr: PullRequestContext,
  payer: Payer
) {
  const deadline = Date.now() + GENERATION_DEADLINE_MS;
  await prisma.pullRequestJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });

  const progress = progressReporter(jobId, project, pr);

  try {
    const run = await pullRequestRun(jobId, project, pr, payer, progress, deadline);

    // 샌드박스 실행 줄에 세웠다. 결과 전달과 마무리는 차례가 오면 runQueuedTestRun 이 한다.
    if (run === "awaiting-run") {
      await dispatchTestRuns(project.teamId);
      return;
    }

    // 처리하는 사이에 새 커밋이 푸시됐으면 옛 결과로 코멘트를 덮지 않는다.
    // sticky 코멘트는 PR 에 하나라, 늦게 끝난 옛 작업이 새 결과를 지워버린다.
    if (await isSuperseded(jobId, project.id, pr.number)) {
      await finish(jobId, "superseded");
      return;
    }

    await deliverRunSummary(project, pr, run);
    await finish(jobId, "done");
  } catch (error) {
    await failJob(jobId, project, pr, progress, error, (message) =>
      finish(jobId, "failed", message)
    );
  }
}

/**
 * 차례가 온 작업의 샌드박스 실행. api/internal/pr-test-run 이 새 함수에서 부른다.
 *
 * 생성 쪽 메모리에 있던 값(PR 정보·컴포넌트)은 runInput 에서, 테스트 본문은 PullRequestTest 에서 읽는다.
 * 끝나면 결과와 상관없이 같은 팀의 다음 작업을 넘긴다. 안 넘기면 줄이 멈춘다.
 */
export async function runQueuedTestRun(jobId: string) {
  const job = await prisma.pullRequestJob.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      headSha: true,
      runInput: true,
      project: { select: JOB_PROJECT_SELECT },
      tests: {
        orderBy: { testPath: "asc" },
        select: { filePath: true, testPath: true, code: true },
      },
    },
  });
  if (!job) return;

  try {
    // 넘겨받기 전에 Re-run 으로 다시 queued 가 됐다. 그 흐름이 생성부터 다시 한다.
    if (job.status !== "testing") return;

    const input = parseRunInput(job.runInput);
    if (!input) {
      console.error(`[pull-request-job] ${jobId} has no usable run input`);
      await finishTestRun(jobId, "failed", "The run input for this job is missing or malformed.");
      return;
    }

    await runTestStage(jobId, job.project, job.headSha, job.tests, input);
  } finally {
    await dispatchTestRuns(job.project.teamId);
  }
}

async function runTestStage(
  jobId: string,
  project: JobProject,
  headSha: string,
  tests: GeneratedPullRequestTest[],
  input: RunInput
) {
  const { pr } = input;
  const progress = progressReporter(jobId, project, pr);
  const stillCurrent = () => isCurrentTestRun(jobId, project.id, pr.number);

  try {
    // 줄에서 기다리는 사이에 새 커밋이 왔으면 샌드박스를 띄우지 않는다.
    if (!(await stillCurrent())) {
      await finishTestRun(jobId, "superseded");
      return;
    }

    const watch = watchStillCurrent(stillCurrent);
    const testRun = await runPullRequestTests({
      project,
      headSha,
      tests,
      signal: watch.signal,
    }).finally(watch.stop);

    // 실행 중에 새 커밋이 오거나 Re-run 이 눌려 끊었다. 끊긴 결과(error)를 저장하거나 코멘트로 보내지 않는다.
    if (watch.signal.aborted) {
      console.info(`[pull-request-job] test run for #${pr.number} stopped by a newer job`);
      await finishTestRun(jobId, "superseded");
      return;
    }

    console.info(
      `[pull-request-job] test run for #${pr.number}`,
      testRun.kind === "ran"
        ? {
            status: testRun.result.status,
            totals: testRun.result.report?.totals ?? null,
            errorMessage: testRun.result.errorMessage ?? null,
          }
        : { notRun: testRun.reason }
    );

    // 끝나는 사이에 새 커밋이 왔으면 옛 결과로 코멘트·화면을 덮지 않는다.
    if (!(await stillCurrent())) {
      await finishTestRun(jobId, "superseded");
      return;
    }

    await saveRunResult(jobId, pr.number, testRun);
    const run = finalRun(queuedRun(danteLinks(project.ref, pr.number)), {
      components: input.components,
      generation: { tests, failedFiles: input.failedFiles, stopped: input.stopped },
      testRun,
    });
    await deliverRunSummary(project, pr, run);
    await finishTestRun(jobId, "done");
  } catch (error) {
    await failJob(jobId, project, pr, progress, error, (message) =>
      finishTestRun(jobId, "failed", message)
    );
  }
}

/**
 * 생성·실행은 분 단위라 단계마다 같은 코멘트·체크를 고쳐 쓴다(generating → running).
 * 그사이 새 커밋이 왔으면 옛 작업의 진행 상태로 새 작업의 코멘트를 덮지 않는다.
 */
function progressReporter(jobId: string, project: JobProject, pr: PullRequestContext) {
  return async (run: RunSummary) => {
    if (await isSuperseded(jobId, project.id, pr.number)) return;
    await deliverRunSummary(project, pr, run);
  };
}

/**
 * 예상 못 한 실패로 작업을 닫는다.
 *
 * deliverRunSummary 는 던지지 않으니 여기 오는 건 DB 나 예상 못 한 실패다.
 * 응답은 이미 나갔으므로 GitHub 재시도에 기댈 수 없다. 흔적을 남기는 게 전부다.
 */
async function failJob(
  jobId: string,
  project: JobProject,
  pr: PullRequestContext,
  progress: (run: RunSummary) => Promise<void>,
  error: unknown,
  close: (message: string) => Promise<unknown>
) {
  console.error(`[pull-request-job] ${jobId} failed for #${pr.number}`, error);
  await close(error instanceof Error ? error.message : String(error)).catch(() => {});
  // 진행 상태(generating·running)를 이미 보냈으면 체크가 in_progress 로 남아 영원히 돈다.
  // 결론을 채워 닫는다. 이것마저 실패하면 할 수 있는 게 없다.
  await progress({
    ...queuedRun(danteLinks(project.ref, pr.number)),
    status: "failed",
    error: "Dante stopped before it could finish this run. Re-run to try again.",
  }).catch(() => {});
}

function finish(jobId: string, status: "done" | "failed" | "superseded", error?: string) {
  return prisma.pullRequestJob.update({
    where: { id: jobId },
    data: { status, error: error ?? null, finishedAt: new Date() },
  });
}

/**
 * 실행 단계의 마무리. 아직 testing 일 때만 적는다.
 *
 * 실행하는 사이에 Re-run 으로 같은 작업이 queued 로 돌아갔으면 그 흐름이 이 행의 주인이다. 덮지 않는다.
 */
function finishTestRun(jobId: string, status: "done" | "failed" | "superseded", error?: string) {
  return prisma.pullRequestJob.updateMany({
    where: { id: jobId, status: "testing" },
    data: { status, error: error ?? null, finishedAt: new Date() },
  });
}

/** 이 PR 에 이 작업보다 나중에 들어온 작업이 있는지. */
async function isSuperseded(jobId: string, projectId: string, prNumber: number) {
  const latest = await prisma.pullRequestJob.findFirst({
    where: { projectId, prNumber },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return latest !== null && latest.id !== jobId;
}

/** 실행 단계의 작업이 아직 유효한지. 새 커밋이 왔거나 Re-run 으로 다시 queued 가 됐으면 아니다. */
async function isCurrentTestRun(jobId: string, projectId: string, prNumber: number) {
  if (await isSuperseded(jobId, projectId, prNumber)) return false;
  const job = await prisma.pullRequestJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === "testing";
}

/** 실행 중 작업이 아직 유효한지 확인하는 주기. 끊기까지 최대 이만큼 늦는다. */
const STILL_CURRENT_POLL_MS = 5_000;

/**
 * 실행하는 동안 작업이 아직 유효한지 주기적으로 보고, 아니면 signal 을 끊는다.
 *
 * 샌드박스 실행은 분 단위라 끝날 때까지 기다리면 옛 커밋의 샌드박스 요금이 그대로 나간다.
 * 확인이 실패하면 끊지 않는다. 모르는데 끊으면 최신 커밋의 실행을 버리게 된다.
 */
function watchStillCurrent(stillCurrent: () => Promise<boolean>) {
  const controller = new AbortController();
  const timer = setInterval(() => {
    stillCurrent()
      .then((current) => {
        if (!current) controller.abort();
      })
      .catch(() => {});
  }, STILL_CURRENT_POLL_MS);
  return { signal: controller.signal, stop: () => clearInterval(timer) };
}

/**
 * preview 화면이 읽는다. 로그는 크니 따로 둔다. 실행하지 않았으면 이전 결과를 지운다 —
 * Re-run 한 같은 커밋에 옛 결과가 남으면 지금 코멘트와 화면이 어긋난다.
 * 저장이 실패해도 PR 에는 결과를 보낸다. 화면 하나 때문에 코멘트·체크가 멈추면 안 된다.
 */
async function saveRunResult(jobId: string, prNumber: number, testRun: PullRequestTestRun) {
  const { logs, ...runResult } = testRun.kind === "ran" ? testRun.result : { logs: null };
  await prisma.pullRequestJob
    .update({
      where: { id: jobId },
      data: {
        runResult: testRun.kind === "ran" ? runResult : Prisma.DbNull,
        runLogs: logs,
      },
    })
    .catch((error) => {
      console.error(`[pull-request-job] saving run result failed for #${prNumber}`, error);
    });
}

/**
 * 이 PR 의 생성 결과. 바뀐 컴포넌트가 없으면 여기서 바로 끝난다(unchanged).
 *
 * 샌드박스를 띄울 테스트가 있으면 실행 줄에 세우고 "awaiting-run" 을 돌려준다. 결과는 실행 쪽이 보낸다.
 * 못 돌리는 경우(테스트 없음·러너 미선택·샌드박스 미설정)는 여기서 최종 결과를 만든다.
 *
 * 파일 목록을 못 읽으면 unchanged 로 접지 않고 failed 로 둔다.
 * 모르는데 "바뀐 게 없다"고 적으면 실제로 컴포넌트를 고친 PR 에서 코멘트가
 * 빠지고, 체크도 통과처럼 보인다. queued 로 두면 체크가 끝나지 않는다.
 */
async function pullRequestRun(
  jobId: string,
  project: JobProject,
  pr: PullRequestContext,
  payer: Payer,
  progress: (run: RunSummary) => Promise<void>,
  deadline: number
): Promise<RunSummary | "awaiting-run"> {
  const { number: prNumber, headSha } = pr;
  const run = queuedRun(danteLinks(project.ref, prNumber));
  const ref = { owner: project.repoOwner, repo: project.repoName };

  let octokit: Octokit;
  let files: ChangedFile[];
  try {
    octokit = await installationClient(project.installationId);
    files = changedComponentFiles(await fetchPullRequestFiles(octokit, ref, prNumber));
  } catch (error) {
    console.error(`[pull-request-job] changed files lookup failed for #${prNumber}`, error);
    return {
      ...run,
      status: "failed",
      error: "Dante could not read the files changed in this pull request.",
    };
  }

  // 경로로 먼저 거른다. 여기서 비면 파일 내용을 한 번도 받지 않고 끝난다.
  if (files.length === 0) return { ...run, status: "unchanged" };

  const { components: located, sources } = await componentsIn(octokit, ref, headSha, files);
  if (located.length === 0) return { ...run, status: "unchanged" };
  const components = located.map(({ name, change, tests }) => ({ name, change, tests }));

  // 할 일이 있을 때만 비용을 낼 사람을 본다. README PR 에 "작성자가 멤버가 아님"을 적을 이유가 없다.
  const author = await checkPayer(project.teamId, pr.author, payer);
  if (author.kind !== "ok") return { ...run, ...payerOutcome(author, payer), components };

  await progress({ ...run, status: "generating", components });

  // 테스트가 레포에 없는 패키지를 import 하면 파일째 실행이 깨진다. head 커밋의 package.json 을
  // 한 번 읽어 프롬프트에 넣는다. 루트만 본다(Runtime 설정도 루트 기준이다).
  const dependencies = packageDependencies(
    await fetchFileText(octokit, ref, "package.json", headSha)
  );

  const generation = await generatePullRequestTests({
    userId: author.userId,
    projectId: project.id,
    testFramework: project.testFramework,
    dependencies,
    sources,
    deadline,
  });
  console.info(`[pull-request-job] generated tests for #${prNumber}`, {
    tests: generation.tests.length,
    failedFiles: generation.failedFiles,
    stopped: generation.stopped,
  });

  // 생성하는 사이에 새 커밋이 왔으면 실행하지 않는다. 호출자가 superseded 로 닫는다.
  if (await isSuperseded(jobId, project.id, prNumber)) return run;

  await savePullRequestTests({
    jobId,
    projectId: project.id,
    framework: project.testFramework,
    tests: generation.tests,
  });

  // 샌드박스를 띄울 작업이면 팀의 실행 줄에 세운다. 이 함수에서 이어 돌리지 않는다 —
  // 생성에 이미 시간을 썼고, 같은 팀의 앞 실행이 끝날 때까지 기다리며 함수를 붙잡을 수도 없다.
  const skip = testRunSkipReason(project, generation.tests);
  if (skip === null) {
    await progress({ ...run, status: "running", components });
    const input: RunInput = {
      pr,
      components: located,
      failedFiles: generation.failedFiles,
      stopped: generation.stopped,
    };
    await prisma.pullRequestJob.update({
      where: { id: jobId },
      data: { status: "awaiting_run", runInput: input },
    });
    return "awaiting-run";
  }

  const testRun: PullRequestTestRun = { kind: "not-run", reason: skip };
  console.info(`[pull-request-job] test run for #${prNumber}`, { notRun: skip });
  await saveRunResult(jobId, prNumber, testRun);

  return finalRun(run, { components: located, generation, testRun });
}

/**
 * 파일 읽기 상한. 웹훅 응답 시간에서는 벗어났지만, 파일 하나가 API 호출 하나라
 * 설치 토큰의 시간당 한도(5,000회)를 아낀다. 넘는 파일은 내용을 안 보고 파일 단위로 센다.
 */
const MAX_FILES_TO_READ = 100;

/**
 * 파일 읽기를 동시에 몇 개까지 보낼지. 100개를 한꺼번에 보내면 GitHub 의 보조 레이트 리밋
 * (동시 요청 수)에 걸릴 수 있다.
 */
const READ_CONCURRENCY = 8;

/**
 * 후보 파일을 PR head 시점으로 읽어 실제 컴포넌트만 남긴다.
 *
 * 모르면 남긴다. 지워진 파일(읽을 내용이 없다), 못 읽은 파일, 상한을 넘은 파일은
 * 파일 이름 하나로 센다 — 여기서 빼면 컴포넌트를 고친 PR 이 unchanged 로 끝난다.
 * 읽었는데 컴포넌트가 없는 파일만 뺀다.
 *
 * 컴포넌트가 확인된 파일의 본문도 같이 돌려준다. 테스트 생성이 같은 파일을 다시 받지 않게.
 */
async function componentsIn(
  octokit: Octokit,
  ref: RepoRef,
  headSha: string,
  files: ChangedFile[]
): Promise<{ components: LocatedComponent[]; sources: PullRequestSource[] }> {
  const perFile = await mapConcurrent(
    files,
    READ_CONCURRENCY,
    async (
      file,
      index
    ): Promise<{ components: LocatedComponent[]; source?: PullRequestSource }> => {
      const fallback = {
        components: [
          {
            name: fileComponentName(file.filePath),
            change: file.change,
            tests: 0,
            filePath: file.filePath,
          },
        ],
      };
      if (file.change === "removed" || index >= MAX_FILES_TO_READ) return fallback;

      const source = await fetchFileText(octokit, ref, file.filePath, headSha);
      if (source === null) return fallback;

      const components = extractComponents(file.filePath, source).map((component) => ({
        name: component.name ?? fileComponentName(file.filePath),
        change: file.change,
        tests: 0,
        filePath: file.filePath,
      }));
      if (components.length === 0) return { components };
      return { components, source: { filePath: file.filePath, source } };
    }
  );

  return {
    components: perFile.flatMap((file) => file.components),
    sources: perFile.flatMap((file) => (file.source ? [file.source] : [])),
  };
}
