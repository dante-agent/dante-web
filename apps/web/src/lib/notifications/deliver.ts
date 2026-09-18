import { prisma } from "@dante/db";
import {
  errorDetail,
  installationClient,
  upsertCheckRun,
  upsertSummaryComment,
  type Octokit,
  type RepoRef,
} from "@/lib/github/pull-request";
import { checkRunResult, skippedCheckRun } from "@/lib/notifications/check-run";
import { renderPrComment } from "@/lib/notifications/comment";
import { deliverDiscord } from "@/lib/notifications/discord-send";
import type { PullRequestAuthor } from "@/lib/notifications/pr-author-rules";
import type { RunSummary } from "@/lib/notifications/run-summary";
import { evaluateScope } from "@/lib/notifications/scope";
import { isSnoozed, type NotificationSettings } from "@/lib/notifications/settings";
import { loadNotificationSettings, recordDelivery } from "@/lib/notifications/store";
import { deliverSlack } from "@/lib/slack/deliver";

// ⚠️ 서버 전용.
//
// "실행 결과 하나를 PR 에 되돌려준다"의 한 자리. 웹훅과 (나중에) 러너 콜백이
// 둘 다 여기를 부른다. Slack 도 여기서 같이 보낸다(lib/slack/deliver.ts).
//
// 여기서 던지지 않는 것이 규칙이다. 부르는 쪽은 대개 GitHub 웹훅이고, 웹훅에서
// 500 을 내면 GitHub 이 같은 배달을 재시도한다. 권한이 없어서 403 이 나는 상황은
// 재시도로 풀리지 않으므로, 실패는 전달 로그에 적고 조용히 끝낸다.

export type PullRequestContext = {
  number: number;
  /** 체크가 붙을 커밋. 코멘트와 달리 체크는 PR 이 아니라 커밋에 달린다 */
  headSha: string;
  /** 머지될 대상 (base). 브랜치 필터가 보는 값 */
  baseRef: string;
  draft: boolean;
  labels: string[];
  headCommitMessage: string | null;
  /** PR 작성자. 테스트 생성 비용을 이 사람 한도로 센다. 페이로드에 없으면 null */
  author: PullRequestAuthor | null;
};

/** 알림을 보내는 데 필요한 프로젝트 쪽 사실. */
type NotifiableProject = {
  id: string;
  ref: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
  /** Slack 연결은 팀에 붙는다 */
  teamId: string;
};

export async function deliverRunSummary(
  project: NotifiableProject,
  pr: PullRequestContext,
  run: RunSummary
) {
  const settings = await loadNotificationSettings(project.id);
  const decision = evaluateScope(settings, {
    baseRef: pr.baseRef,
    defaultBranch: project.defaultBranch,
    draft: pr.draft,
    labels: pr.labels,
    headCommitMessage: pr.headCommitMessage,
  });

  if (!decision.write) {
    await deliverSkip(project, pr, settings, decision.reason);
    return;
  }

  const repo: RepoRef = { owner: project.repoOwner, repo: project.repoName };

  // GitHub 설치 토큰을 못 받아도 Slack·Discord 는 보낼 수 있다. 그래서 먼저 보낸다.
  await deliverSlack(project, pr.number, run, settings);
  await deliverDiscord(
    {
      projectId: project.id,
      repo: `${repo.owner}/${repo.repo}`,
      prNumber: pr.number,
      prUrl: `https://github.com/${repo.owner}/${repo.repo}/pull/${pr.number}`,
    },
    run,
    settings
  );

  const surface = await loadSurface(project.id, pr.number);

  let octokit: Octokit;
  try {
    octokit = await installationClient(project.installationId);
  } catch (error) {
    // 설치 토큰조차 못 받는 경우(앱 삭제·정지). 표면별로 같은 실패를 두 줄
    // 남길 이유가 없으니 한 줄만 적는다.
    await recordDelivery({
      projectId: project.id,
      surface: "github_comment",
      prNumber: pr.number,
      status: "failed",
      detail: errorDetail(error),
    });
    return;
  }

  if (settings.prCommentEnabled) {
    await deliverComment(octokit, repo, project, pr, run, settings, surface.commentId);
  }

  if (settings.checkRunEnabled) {
    await deliverCheck(octokit, repo, project, pr, run, settings, surface.checkRunId);
  }
}

/**
 * 범위 밖이라 조용히 지나가는 경우.
 *
 * 스누즈는 정말 아무것도 쓰지 않는다 — "GitHub 에 아무것도 쓰지 않기"를 켠 것이
 * 스누즈의 정의다. 반면 브랜치 필터·드래프트로 걸린 경우에는 체크만 skipped 로
 * 남긴다. 이유는 required check 때문이다: `dante` 를 required 로 걸어 둔 레포에서
 * 우리가 아무 체크도 만들지 않으면 그 PR 은 영영 "기다리는 중"이 되어 머지가
 * 막힌다. 조용히 넘어가려다 남의 머지를 막는 쪽이 더 나쁘다.
 */
async function deliverSkip(
  project: NotifiableProject,
  pr: PullRequestContext,
  settings: NotificationSettings,
  reason: string
) {
  const log = (surface: "github_comment" | "github_check") =>
    recordDelivery({
      projectId: project.id,
      surface,
      prNumber: pr.number,
      status: "skipped",
      detail: reason,
    });

  if (settings.prCommentEnabled) await log("github_comment");

  if (!settings.checkRunEnabled || isSnoozed(settings)) {
    if (settings.checkRunEnabled) await log("github_check");
    return;
  }

  const surface = await loadSurface(project.id, pr.number);

  try {
    const octokit = await installationClient(project.installationId);
    const checkRunId = await upsertCheckRun(
      octokit,
      { owner: project.repoOwner, repo: project.repoName },
      pr.headSha,
      skippedCheckRun(reason, settings.prCommentLocale),
      { cachedCheckRunId: surface.checkRunId, detailsUrl: null }
    );
    await saveSurface(project.id, pr.number, { checkRunId, lastConclusion: "skipped" });
    await log("github_check");
  } catch (error) {
    await recordDelivery({
      projectId: project.id,
      surface: "github_check",
      prNumber: pr.number,
      status: "failed",
      detail: errorDetail(error),
    });
  }
}

async function deliverComment(
  octokit: Octokit,
  repo: RepoRef,
  project: NotifiableProject,
  pr: PullRequestContext,
  run: RunSummary,
  settings: NotificationSettings,
  cachedCommentId: number | null
) {
  // 변경된 컴포넌트가 없는 PR 에는 아무것도 남기지 않는다. 단, 이미 코멘트가
  // 달린 PR 이라면 지우지 않고 갱신한다 — 지우면 "아까 그 실패는 어디 갔지"가 된다.
  if (run.status === "unchanged" && settings.prCommentSkipUnchanged && cachedCommentId === null) {
    await recordDelivery({
      projectId: project.id,
      surface: "github_comment",
      prNumber: pr.number,
      status: "skipped",
      detail: "no components changed",
    });
    return;
  }

  try {
    const commentId = await upsertSummaryComment(
      octokit,
      repo,
      pr.number,
      renderPrComment(run, settings),
      { mode: settings.prCommentMode, cachedCommentId }
    );

    // append 모드에서도 마지막 코멘트 ID 를 적어 둔다. 나중에 sticky 로 바꾸면
    // 그 코멘트부터 이어서 고치게 된다.
    await saveSurface(project.id, pr.number, { commentId });
    await recordDelivery({
      projectId: project.id,
      surface: "github_comment",
      prNumber: pr.number,
      status: "ok",
      detail: cachedCommentId === null ? "created" : "updated",
    });
  } catch (error) {
    await recordDelivery({
      projectId: project.id,
      surface: "github_comment",
      prNumber: pr.number,
      status: "failed",
      detail: errorDetail(error),
    });
  }
}

async function deliverCheck(
  octokit: Octokit,
  repo: RepoRef,
  project: NotifiableProject,
  pr: PullRequestContext,
  run: RunSummary,
  settings: NotificationSettings,
  cachedCheckRunId: number | null
) {
  const result = checkRunResult(run, settings);

  try {
    const checkRunId = await upsertCheckRun(octokit, repo, pr.headSha, result, {
      cachedCheckRunId,
      detailsUrl: run.detailUrl,
    });

    await saveSurface(project.id, pr.number, {
      checkRunId,
      // 진행 중이면 결론이 없다. 그때는 마지막 결론을 덮어쓰지 않는다 —
      // "실패 → 실패 재알림 안 함" 판정이 중간 상태로 초기화되면 안 된다.
      ...(result.conclusion ? { lastConclusion: result.conclusion } : {}),
    });

    await recordDelivery({
      projectId: project.id,
      surface: "github_check",
      prNumber: pr.number,
      status: "ok",
      detail: result.conclusion ?? result.status,
    });
  } catch (error) {
    await recordDelivery({
      projectId: project.id,
      surface: "github_check",
      prNumber: pr.number,
      status: "failed",
      detail: errorDetail(error),
    });
  }
}

async function loadSurface(projectId: string, prNumber: number) {
  const row = await prisma.pullRequestSurface.findUnique({
    where: { projectId_prNumber: { projectId, prNumber } },
  });

  return {
    // DB 는 BigInt 로 들고 있지만 GitHub 의 코멘트·체크 ID 는 2^53 안쪽이라
    // number 로 좁혀 쓴다 (lib/github/repos.ts 와 같은 판단).
    commentId:
      row?.commentId === null || row?.commentId === undefined ? null : Number(row.commentId),
    checkRunId:
      row?.checkRunId === null || row?.checkRunId === undefined ? null : Number(row.checkRunId),
    lastConclusion: row?.lastConclusion ?? null,
  };
}

async function saveSurface(
  projectId: string,
  prNumber: number,
  patch: { commentId?: number; checkRunId?: number; lastConclusion?: string }
) {
  await prisma.pullRequestSurface.upsert({
    where: { projectId_prNumber: { projectId, prNumber } },
    create: { projectId, prNumber, ...patch },
    update: patch,
  });
}
