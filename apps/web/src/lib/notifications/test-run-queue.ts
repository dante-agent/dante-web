import { prisma } from "@dante/db";
import { isStaleTestRun, signTestRunToken } from "@/lib/notifications/test-run-rules";

// ⚠️ 서버 전용. 팀 단위 샌드박스 실행 줄 (docs/adr/0002-run-sandbox-from-web.md).
//
// 같은 팀 안에서는 샌드박스 실행(PullRequestJob.status = "testing")을 하나만 둔다. 다른 팀끼리는
// 서로 기다리지 않는다. AI 생성은 샌드박스를 쓰지 않아 이 줄과 무관하다.
//
// 왜 메모리 큐가 아닌가: web 은 서버리스라 인스턴스가 여러 개다. 줄의 상태는 DB 에만 둔다.
// 왜 외부 큐가 아닌가: 새 서비스 없이 된다. 대신 넘기는 요청이 실패하면 자동 재시도가 없어서,
// 같은 팀에 작업이 새로 넘어올 때마다 다시 차례를 본다.

/**
 * 팀의 실행 자리가 비었으면 가장 먼저 기다린 작업을 실행 함수로 넘긴다.
 *
 * 생성이 끝나 작업을 줄에 세웠을 때, 그리고 실행이 끝났을 때 부른다. 던지지 않는다 —
 * 부르는 쪽은 이미 자기 일을 마쳤고, 여기서 실패해도 다음 호출이 다시 시도한다.
 */
export async function dispatchTestRuns(teamId: string) {
  let jobId: string | null;
  try {
    jobId = await claimNextTestRun(teamId);
  } catch (error) {
    console.error(`[test-run-queue] claiming a run failed for team ${teamId}`, error);
    return;
  }
  if (!jobId) return;

  try {
    await triggerTestRun(jobId);
  } catch (error) {
    console.error(`[test-run-queue] handing off ${jobId} failed`, error);
    // 못 넘겼으면 자리를 돌려놓는다. testing 으로 두면 죽은 실행으로 판정될 때까지 팀 전체가 막힌다.
    await prisma.pullRequestJob
      .updateMany({
        where: { id: jobId, status: "testing" },
        data: { status: "awaiting_run", runStartedAt: null },
      })
      .catch(() => {});
  }
}

/**
 * 실행 자리를 잡는다. 잡았으면 그 작업 ID, 자리가 없거나 기다리는 작업이 없으면 null.
 *
 * 팀마다 advisory lock 을 트랜잭션 동안만 잡는다. 락 없이 "실행 중이 없으면 바꾼다" 를 하면
 * 두 함수가 동시에 "없다" 를 보고 둘 다 실행한다. 샌드박스가 도는 몇 분 동안은 락을 들고 있지 않는다 —
 * 그동안 자리를 막는 것은 testing 상태 자체다.
 */
async function claimNextTestRun(teamId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pr-test-run:${teamId}`}))`;
    const now = new Date();

    const testing = await tx.pullRequestJob.findMany({
      where: { status: "testing", project: { teamId } },
      select: { id: true, runStartedAt: true },
    });

    // 함수가 죽어 testing 으로 남은 작업. 닫아야 줄이 다시 흐른다. 체크는 in_progress 로 남으니
    // 사용자는 Re-run 으로 다시 돌린다 — 여기서 GitHub 에 쓰려면 트랜잭션 안에서 네트워크를 타야 한다.
    const stale = testing.filter((job) => isStaleTestRun(job.runStartedAt, now));
    if (stale.length > 0) {
      await tx.pullRequestJob.updateMany({
        where: { id: { in: stale.map((job) => job.id) }, status: "testing" },
        data: {
          status: "failed",
          error: "The test run stopped without reporting back.",
          finishedAt: now,
        },
      });
    }
    if (testing.length > stale.length) return null;

    // 생성이 끝난 순서대로. awaiting_run 으로 바꿀 때 updatedAt 이 그 시각이 된다.
    const next = await tx.pullRequestJob.findFirst({
      where: { status: "awaiting_run", project: { teamId } },
      orderBy: { updatedAt: "asc" },
      select: { id: true },
    });
    if (!next) return null;

    await tx.pullRequestJob.update({
      where: { id: next.id },
      data: { status: "testing", runStartedAt: now },
    });
    return next.id;
  });
}

/** 넘기는 요청의 응답 대기. 실행 함수는 받자마자 202 를 돌려주므로 오래 걸릴 일이 없다. */
const TRIGGER_TIMEOUT_MS = 15_000;

/**
 * 실행을 새 함수에서 시작하게 한다.
 *
 * 지금 함수에서 이어 돌리지 않는 이유: 함수 수명(maxDuration)은 호출 하나에 붙는다. 생성에 이미 쓴
 * 시간이나 앞 실행에 쓴 시간 위에 이어 붙이면, 줄이 길수록 뒤 작업이 중간에 잘린다.
 */
async function triggerTestRun(jobId: string) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) throw new Error("GITHUB_APP_WEBHOOK_SECRET 가 없습니다. .env.example 참고.");

  const response = await fetch(`${internalBaseUrl()}/api/internal/pr-test-run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${signTestRunToken(secret, jobId, new Date())}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ jobId }),
    signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
  });
  if (response.status !== 202) {
    throw new Error(`internal run ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

/**
 * 실행 함수를 부를 주소.
 *
 * Vercel 에서는 운영 도메인을 쓴다. 배포별 URL(VERCEL_URL)은 Deployment Protection 에 막힐 수 있다.
 * 로컬은 NEXT_PUBLIC_APP_URL 이 운영 주소로 잡혀 있기도 해서 그 값을 쓰지 않는다 — 로컬 작업이 운영
 * 서버에서 돌게 된다. INTERNAL_APP_URL 이 있으면 어디서든 그 값이 이긴다.
 */
function internalBaseUrl() {
  const override = process.env.INTERNAL_APP_URL?.replace(/\/+$/, "");
  if (override) return override;

  if (process.env.VERCEL === "1") {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    if (configured) return configured;
    const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (production) return `https://${production}`;
    throw new Error("NEXT_PUBLIC_APP_URL 가 없습니다. .env.example 참고.");
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
}
