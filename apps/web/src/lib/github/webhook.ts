import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@dante/db";
import {
  fetchHeadCommitMessage,
  fetchPullRequest,
  installationClient,
} from "@/lib/github/pull-request";
import type { PullRequestContext } from "@/lib/notifications/deliver";
import { enqueuePullRequestJob } from "@/lib/notifications/pull-request-job";

// ⚠️ 서버 전용. 웹훅 시크릿을 읽는다.
//
// GitHub 이 "연결이 바뀌었다"고 알려주는 쪽. 우리가 물어보는 쪽(lib/github/repos.ts)과
// 짝을 이룬다:
//   물어보기  "지금 어떤 레포 볼 수 있어?"  → 화면을 그릴 때마다 API 호출
//   알려주기  "방금 레포가 빠졌어"          → 이 파일. DB 에 표시만 남긴다
//
// 알려주기가 필요한 이유는 하나다. 사용자가 GitHub 쪽에서 연결을 끊어도 우리
// 서버에는 아무 요청이 오지 않는다. 그래서 화면을 열기 전까지는 끊긴 걸 모른다.

/** 우리가 처리하는 이벤트에서 실제로 읽는 필드만 추린 모양. */
type InstallationEvent = {
  action: string;
  installation?: { id: number };
};

type InstallationRepositoriesEvent = InstallationEvent & {
  repositories_added?: { id: number }[];
  repositories_removed?: { id: number }[];
};

type RepositoryEvent = InstallationEvent & {
  repository?: {
    id: number;
    name: string;
    owner: { login: string };
    private: boolean;
    default_branch: string;
  };
};

type WebhookPayload = InstallationRepositoriesEvent & {
  repository?: { id: number };
};

const WEBHOOK_RETENTION_DAYS = 30;

const webhookRetentionCutoff = (now = new Date()) =>
  new Date(now.getTime() - WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000);

/**
 * 서명 검증.
 *
 * `@octokit/webhooks` 에 같은 기능이 있지만 octokit 의 하위 의존성이라
 * pnpm 격리 구조에서는 apps/web 에서 직접 import 할 수 없다. 직접 추가할 만큼
 * 큰 일도 아니라 Node 내장 crypto 로 짠다 (AGENTS.md: 몇 줄로 될 일은 직접).
 *
 * body 는 **파싱 전 원본 문자열**이어야 한다. JSON.parse 후 다시 stringify 하면
 * 키 순서나 공백이 달라져 서명이 어긋난다.
 */
export function verifySignature(body: string, signature: string | null) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("GITHUB_APP_WEBHOOK_SECRET 가 없습니다. .env.example 참고.");
  }
  if (!signature) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  // timingSafeEqual 은 길이가 다르면 던진다. 길이 자체는 비밀이 아니라 먼저 비교해도 된다.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** PR 이 열리거나 푸시가 왔을 때. 알림을 시작하는 이벤트다. */
type PullRequestEvent = InstallationEvent & {
  repository?: { id: number };
  pull_request?: {
    number: number;
    draft?: boolean;
    head: { sha: string };
    base: { ref: string };
    labels?: { name: string }[];
  };
};

/** Check 상세 화면의 Re-run 버튼. */
type CheckRunEvent = InstallationEvent & {
  repository?: { id: number };
  check_run?: {
    head_sha: string;
    pull_requests?: { number: number }[];
  };
};

/**
 * 이벤트 하나를 DB 에 반영한다.
 *
 * 어떤 이벤트든 "지금 상태를 이렇게 맞춰라"로만 쓴다(덮어쓰기). GitHub 은 배달을
 * 재시도하고 순서도 보장하지 않으므로, 같은 배달이 두 번 와도 결과가 같아야 한다.
 *
 * @returns 로그에 남길 한 줄. 처리하지 않은 이벤트면 null.
 */
export async function handleWebhookEvent(event: string, payload: unknown) {
  await recordWebhookDelivery(event, payload as WebhookPayload);

  switch (event) {
    case "installation":
      return handleInstallation(payload as InstallationEvent);
    case "installation_repositories":
      return handleInstallationRepositories(payload as InstallationRepositoriesEvent);
    case "repository":
      return handleRepository(payload as RepositoryEvent);
    case "pull_request":
      return handlePullRequest(payload as PullRequestEvent);
    case "check_run":
      return handleCheckRun(payload as CheckRunEvent);
    default:
      return null;
  }
}

/**
 * 수신한 웹훅을 이 레포와 연결된 프로젝트별로 한 줄씩 남긴다.
 *
 * installation 사건은 레포가 없어서 설치의 모든 프로젝트에, 레포 목록 변경은
 * payload 에 든 레포들에 기록한다. 기록 실패가 본래 웹훅 처리를 막지는 않는다.
 */
async function recordWebhookDelivery(event: string, payload: WebhookPayload) {
  const id = installationId(payload);
  if (id === null) return;

  const repositoryId = payload.repository?.id;
  const listedRepoIds = repoIds([
    ...(payload.repositories_added ?? []),
    ...(payload.repositories_removed ?? []),
  ]);
  const webhookRepoIds =
    typeof repositoryId === "number" && Number.isSafeInteger(repositoryId) && repositoryId > 0
      ? [BigInt(repositoryId)]
      : listedRepoIds;

  try {
    const projects = await prisma.project.findMany({
      where: {
        installationId: id,
        ...(webhookRepoIds.length > 0 && { repoId: { in: webhookRepoIds } }),
      },
      select: { id: true },
    });
    if (projects.length === 0) return;

    const projectIds = projects.map((project) => project.id);
    await prisma.webhookDelivery.createMany({
      data: projectIds.map((projectId) => ({ projectId, event })),
    });
    await prisma.webhookDelivery.deleteMany({
      where: { projectId: { in: projectIds }, createdAt: { lt: webhookRetentionCutoff() } },
    });
  } catch (error) {
    console.error("[github-webhook] delivery log failed", error);
  }
}

/** 설치 단위 사건: 앱 삭제·정지. 설치에 딸린 모든 프로젝트에 해당한다. */
async function handleInstallation(payload: InstallationEvent) {
  const id = installationId(payload);
  if (id === null) return null;

  // 없는 설치에 대고 쓰면 updateMany 가 0건으로 조용히 지나간다.
  // 남의 설치 ID 를 밀어 넣어도 우리 DB 에 없으면 아무 일도 일어나지 않는다.
  const write = (data: { suspendedAt?: Date | null; deletedAt?: Date | null }) =>
    prisma.githubInstallation.updateMany({ where: { id }, data });

  switch (payload.action) {
    case "deleted":
      await write({ deletedAt: new Date() });
      return `installation ${id} deleted`;
    case "suspend":
      await write({ suspendedAt: new Date() });
      return `installation ${id} suspended`;
    case "unsuspend":
      await write({ suspendedAt: null });
      return `installation ${id} unsuspended`;
    // "created" 는 일부러 무시한다. 여기서는 이 설치가 우리 쪽 어느 사용자 것인지
    // 알 수 없다 — 그 연결은 로그인한 상태로 돌아오는 /api/github/setup 이 만든다.
    default:
      return null;
  }
}

/** 레포 단위 사건: 설치에서 레포를 넣고 뺐다. */
async function handleInstallationRepositories(payload: InstallationRepositoriesEvent) {
  const id = installationId(payload);
  if (id === null) return null;

  const added = repoIds(payload.repositories_added);
  const removed = repoIds(payload.repositories_removed);

  if (removed.length > 0) {
    await prisma.project.updateMany({
      where: { installationId: id, repoId: { in: removed } },
      data: { disconnectedAt: new Date(), disconnectedReason: "repo_removed" },
    });
  }

  // 다시 열어주면 되살아난다. 프로젝트를 지웠다 새로 만들 필요가 없다.
  if (added.length > 0) {
    await prisma.project.updateMany({
      where: { installationId: id, repoId: { in: added } },
      data: { disconnectedAt: null, disconnectedReason: null },
    });
  }

  if (added.length === 0 && removed.length === 0) return null;
  return `installation ${id} repos +${added.length} -${removed.length}`;
}

/**
 * 레포 자체의 사건: 이름 변경·이관·삭제·공개 범위 변경.
 *
 * 프로젝트는 repoId 로 추적하므로 rename·이관에도 연결은 안 끊긴다.
 * 다만 화면에 owner/name 을 캐시해 두었으니 여기서 같이 고쳐준다.
 */
async function handleRepository(payload: RepositoryEvent) {
  const id = installationId(payload);
  const repo = payload.repository;
  if (id === null || !repo) return null;

  // repoId 는 전역에서 프로젝트 하나지만(@@unique([repoId])) installationId 도 건다.
  // 설치에서 빠진 뒤 다른 설치로 옮겨 간 프로젝트를 옛 설치의 이벤트가 건드리지 않게.
  const where = { installationId: id, repoId: BigInt(repo.id) };

  switch (payload.action) {
    case "deleted":
      await prisma.project.updateMany({
        where,
        data: { disconnectedAt: new Date(), disconnectedReason: "repo_deleted" },
      });
      return `repo ${repo.id} deleted`;
    case "renamed":
    case "transferred":
      await prisma.project.updateMany({
        where,
        // 프로젝트 이름도 레포 이름을 따라간다. 이름을 따로 바꾸는 기능이 없어서,
        // 여기서 안 고치면 화면에 옛 레포 이름이 영영 남는다.
        data: { repoOwner: repo.owner.login, repoName: repo.name, name: repo.name },
      });
      return `repo ${repo.id} now ${repo.owner.login}/${repo.name}`;
    case "privatized":
    case "publicized":
      await prisma.project.updateMany({ where, data: { isPrivate: repo.private } });
      return `repo ${repo.id} private=${repo.private}`;
    default:
      return null;
  }
}

/**
 * PR 이 열림·푸시·다시 열림·리뷰 준비됨.
 *
 * 여기서는 작업을 적어 두기만 한다. 바뀐 컴포넌트를 찾고 코멘트·체크를 쓰는 일은
 * 응답이 나간 뒤에 한다(lib/notifications/pull-request-job.ts).
 *
 * 우리가 처리하지 않는 action(closed, labeled 등)은 그냥 지나간다. 나중에
 * labeled/unlabeled 를 받아 `skip-dante` 라벨 변화에 반응할 수 있다.
 */
async function handlePullRequest(payload: PullRequestEvent) {
  const id = installationId(payload);
  const pr = payload.pull_request;
  const repoId = payload.repository?.id;
  if (id === null || !pr || typeof repoId !== "number") return null;

  const actions = ["opened", "synchronize", "reopened", "ready_for_review"];
  if (!actions.includes(payload.action)) return null;

  const projects = await notifiableProjects(id, repoId);
  if (projects.length === 0) return null;

  for (const project of projects) {
    const context: PullRequestContext = {
      number: pr.number,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      draft: pr.draft ?? false,
      labels: (pr.labels ?? []).map((label) => label.name),
      headCommitMessage: await commitMessage(project, pr.head.sha),
    };

    await enqueuePullRequestJob(project, context);
  }

  return `pr #${pr.number} ${payload.action} → ${projects.length} project(s)`;
}

/**
 * Check 상세 화면의 Re-run 버튼.
 *
 * 페이로드에는 PR 번호와 SHA 밖에 없어서 나머지(base 브랜치·드래프트·라벨)는
 * API 로 다시 읽는다. 그 값들이 없으면 브랜치 필터를 적용할 수 없다.
 */
async function handleCheckRun(payload: CheckRunEvent) {
  const id = installationId(payload);
  const repoId = payload.repository?.id;
  const prNumber = payload.check_run?.pull_requests?.[0]?.number;

  if (payload.action !== "rerequested") return null;
  if (id === null || typeof repoId !== "number" || typeof prNumber !== "number") return null;

  const projects = await notifiableProjects(id, repoId);
  if (projects.length === 0) return null;

  for (const project of projects) {
    const ref = { owner: project.repoOwner, repo: project.repoName };

    let context: PullRequestContext;
    try {
      const octokit = await installationClient(project.installationId);
      const pr = await fetchPullRequest(octokit, ref, prNumber);
      context = {
        ...pr,
        headCommitMessage: await fetchHeadCommitMessage(octokit, ref, pr.headSha),
      };
    } catch (error) {
      console.error(`[github-webhook] re-run lookup failed for #${prNumber}`, error);
      continue;
    }

    await enqueuePullRequestJob(project, context);
  }

  return `check re-run #${prNumber} → ${projects.length} project(s)`;
}

/**
 * 이 레포에 걸린, 아직 끊기지 않은 프로젝트들.
 *
 * 레포는 전역에서 프로젝트 하나라(@@unique([repoId])) 많아야 한 건이다. 배열로 두는
 * 건 호출부가 "없음"과 "있음"을 같은 모양으로 다루게 하려는 것뿐이다.
 */
function notifiableProjects(installationIdValue: bigint, repoId: number) {
  return prisma.project.findMany({
    where: {
      installationId: installationIdValue,
      repoId: BigInt(repoId),
      disconnectedAt: null,
      // 온보딩을 끝내지 않은 프로젝트에는 아직 아무것도 쓰지 않는다.
      setupCompletedAt: { not: null },
    },
    select: {
      id: true,
      ref: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
    },
  });
}

/** `[skip dante]` 를 보려고 head 커밋 메시지를 읽는다. 못 읽으면 null. */
async function commitMessage(
  project: { repoOwner: string; repoName: string; installationId: bigint },
  sha: string
) {
  try {
    const octokit = await installationClient(project.installationId);
    return await fetchHeadCommitMessage(
      octokit,
      { owner: project.repoOwner, repo: project.repoName },
      sha
    );
  } catch {
    return null;
  }
}

/** 페이로드의 설치 ID. App 으로 오는 이벤트에는 늘 붙지만 타입상 optional 이다. */
function installationId(payload: InstallationEvent) {
  const id = payload.installation?.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? BigInt(id) : null;
}

function repoIds(repos: { id: number }[] | undefined) {
  return (repos ?? [])
    .map((repo) => repo.id)
    .filter((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
    .map((id) => BigInt(id));
}
