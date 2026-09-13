import { after } from "next/server";
import { prisma } from "@dante/db";
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
import { queuedRun, type ComponentChange, type RunSummary } from "@/lib/notifications/run-summary";

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

/** 작업을 돌리는 데 필요한 프로젝트 쪽 사실. deliver.ts 의 NotifiableProject 와 같다. */
export type JobProject = {
  id: string;
  ref: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
};

/**
 * 작업을 적고 응답 뒤에 돌린다.
 *
 * 같은 커밋에 대한 작업은 하나다(projectId·prNumber·headSha). GitHub 이 같은 배달을
 * 다시 보내거나 Re-run 을 누르면 새로 만들지 않고 그 작업을 다시 queued 로 되돌린다.
 */
export async function enqueuePullRequestJob(project: JobProject, pr: PullRequestContext) {
  const key = { projectId: project.id, prNumber: pr.number, headSha: pr.headSha };
  const job = await prisma.pullRequestJob.upsert({
    where: { projectId_prNumber_headSha: key },
    create: { ...key, status: "queued" },
    update: { status: "queued", error: null, startedAt: null, finishedAt: null },
    select: { id: true },
  });

  after(() => runPullRequestJob(job.id, project, pr));
}

async function runPullRequestJob(jobId: string, project: JobProject, pr: PullRequestContext) {
  await prisma.pullRequestJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    const run = await pullRequestRun(project, pr.number, pr.headSha);

    // 처리하는 사이에 새 커밋이 푸시됐으면 옛 결과로 코멘트를 덮지 않는다.
    // sticky 코멘트는 PR 에 하나라, 늦게 끝난 옛 작업이 새 결과를 지워버린다.
    if (await isSuperseded(jobId, project.id, pr.number)) {
      await finish(jobId, "superseded");
      return;
    }

    await deliverRunSummary(project, pr, run);
    await finish(jobId, "done");
  } catch (error) {
    // deliverRunSummary 는 던지지 않으니 여기 오는 건 DB 나 예상 못 한 실패다.
    // 응답은 이미 나갔으므로 GitHub 재시도에 기댈 수 없다. 흔적을 남기는 게 전부다.
    console.error(`[pull-request-job] ${jobId} failed for #${pr.number}`, error);
    await finish(jobId, "failed", error instanceof Error ? error.message : String(error)).catch(
      () => {}
    );
  }
}

function finish(jobId: string, status: "done" | "failed" | "superseded", error?: string) {
  return prisma.pullRequestJob.update({
    where: { id: jobId },
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

/**
 * 이 PR 의 첫 상태. 바뀐 컴포넌트가 없으면 여기서 바로 끝난다(unchanged).
 *
 * 파일 목록을 못 읽으면 unchanged 로 접지 않고 평소대로 Queued 로 둔다.
 * 모르는데 "바뀐 게 없다"고 적으면 실제로 컴포넌트를 고친 PR 에서 코멘트가
 * 빠지고, 체크도 통과처럼 보인다.
 */
async function pullRequestRun(
  project: JobProject,
  prNumber: number,
  headSha: string
): Promise<RunSummary> {
  const run = queuedRun(danteLinks(project.ref, prNumber));
  const ref = { owner: project.repoOwner, repo: project.repoName };

  let octokit: Octokit;
  let files: ChangedFile[];
  try {
    octokit = await installationClient(project.installationId);
    files = changedComponentFiles(await fetchPullRequestFiles(octokit, ref, prNumber));
  } catch (error) {
    console.error(`[pull-request-job] changed files lookup failed for #${prNumber}`, error);
    return run;
  }

  // 경로로 먼저 거른다. 여기서 비면 파일 내용을 한 번도 받지 않고 끝난다.
  if (files.length === 0) return { ...run, status: "unchanged" };

  const components = await componentsIn(octokit, ref, headSha, files);
  return components.length === 0 ? { ...run, status: "unchanged" } : { ...run, components };
}

/**
 * 파일 읽기 상한. 웹훅 응답 시간에서는 벗어났지만, 파일 하나가 API 호출 하나라
 * 설치 토큰의 시간당 한도(5,000회)를 아낀다. 넘는 파일은 내용을 안 보고 파일 단위로 센다.
 */
const MAX_FILES_TO_READ = 100;

/**
 * 후보 파일을 PR head 시점으로 읽어 실제 컴포넌트만 남긴다.
 *
 * 모르면 남긴다. 지워진 파일(읽을 내용이 없다), 못 읽은 파일, 상한을 넘은 파일은
 * 파일 이름 하나로 센다 — 여기서 빼면 컴포넌트를 고친 PR 이 unchanged 로 끝난다.
 * 읽었는데 컴포넌트가 없는 파일만 뺀다.
 */
async function componentsIn(
  octokit: Octokit,
  ref: RepoRef,
  headSha: string,
  files: ChangedFile[]
): Promise<ComponentChange[]> {
  const perFile = await Promise.all(
    files.map(async (file, index): Promise<ComponentChange[]> => {
      const fallback = [{ name: fileComponentName(file.filePath), change: file.change, tests: 0 }];
      if (file.change === "removed" || index >= MAX_FILES_TO_READ) return fallback;

      const source = await fetchFileText(octokit, ref, file.filePath, headSha);
      if (source === null) return fallback;

      return extractComponents(file.filePath, source).map((component) => ({
        name: component.name ?? fileComponentName(file.filePath),
        change: file.change,
        tests: 0,
      }));
    })
  );

  return perFile.flat();
}
