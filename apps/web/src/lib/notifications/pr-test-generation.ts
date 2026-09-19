import { prisma } from "@dante/db";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import { generateTestCode } from "@/lib/projects/test-generation";
import { pullRequestTestPathFor } from "@/lib/projects/test-generation-prompt";
import { generateEach } from "@/lib/notifications/pr-test-generation-loop";

// ⚠️ 서버 전용. PR 에서 바뀐 컴포넌트 파일마다 테스트를 만든다.
//
// AI 비용은 PR 작성자 개인 한도로 센다(pr-author.ts 가 이미 멤버·한도를 확인한 userId).
// 추천 화면과 같은 프롬프트(test-generation.ts)를 쓰되, 파일은 PR head 커밋에서 읽은
// 본문이고 프로젝트가 고른 러너 지시가 붙는다.

/** PR head 커밋에서 읽은 파일 하나 */
export type PullRequestSource = { filePath: string; source: string };

export type GeneratedPullRequestTest = { filePath: string; testPath: string; code: string };

export type PullRequestGeneration = {
  tests: GeneratedPullRequestTest[];
  /** AI 호출이 실패했거나(시간 초과 포함) 마감이 지나 만들지 못한 파일 */
  failedFiles: string[];
  /** 중간에 멈췄으면 그 이유. 남은 파일은 만들지 않았다 */
  stopped: "budget-exceeded" | "budget-unavailable" | null;
};

/**
 * 한 PR 에서 만들 파일 수 상한. 파일 하나가 AI 호출 한 번이라, 컴포넌트를 수십 개
 * 건드린 PR 하나가 작성자의 한 달 한도를 다 쓰지 않게 한다.
 */
const MAX_FILES_TO_GENERATE = 10;

/**
 * 동시에 부르는 파일 수.
 *
 * 하나씩 부르면 파일 10개가 라우트의 maxDuration(800초) 안에 끝나지 않을 수 있다. 너무 많이
 * 부르지 않는 이유: 호출마다 원가 상한을 먼저 예약하므로(budget.ts reserveAiBudget) 한도 직전에서는
 * 동시에 잡힌 예약 몫만큼 뒤 파일이 일찍 막힐 수 있다. 그 폭을 호출 두 건 몫으로 묶는다.
 * 한도를 넘는 폭은 늘지 않는다 — 예약은 사용자별 락 안에서 한 줄로 서서 앞 예약을 합계에서 본다.
 */
const GENERATION_CONCURRENCY = 3;

/**
 * 호출 하나의 상한. 출력 상한(32k 토큰)을 다 쓰는 호출도 보통 이 안에 끝난다. 넘으면 끊고
 * 그 파일은 실패로 센다. 전체 마감(deadline)이 먼저 오면 그쪽에서 끊긴다.
 */
const CALL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * 파일마다 테스트를 만든다. 동시에 몇 개씩, deadline(epoch ms)까지 돈다(pr-test-generation-loop.ts).
 *
 * 한도는 시작할 때 한 번 본다. 파일마다 다시 보지 않는 이유: 호출 직전의 reserveAiBudget 이 같은
 * 기준(합계 ≥ 한도)으로 다시 판정하고, 넘었으면 null 을 준다 — 그때 멈춘다. 시작 때 보는 건
 * 한도를 알 수 없는 경우(설정 누락·DB 실패)를 "budget-unavailable" 로 가르기 위해서다.
 */
export async function generatePullRequestTests(args: {
  userId: string;
  projectId: string;
  testFramework: string | null;
  /** PR head 커밋의 package.json 에 적힌 패키지. 못 읽었으면 null */
  dependencies: string[] | null;
  sources: PullRequestSource[];
  /** 이 시각(epoch ms)이 지나면 새 파일을 시작하지 않고, 돌고 있는 호출도 끊는다 */
  deadline: number;
}): Promise<PullRequestGeneration> {
  const sources = args.sources.slice(0, MAX_FILES_TO_GENERATE);
  if (sources.length === 0) return { tests: [], failedFiles: [], stopped: null };

  try {
    const budget = await getMonthlyBudgetStatus(args.userId);
    if (budget.exceeded) return { tests: [], failedFiles: [], stopped: "budget-exceeded" };
  } catch (error) {
    console.error("[pr-test-generation] 한도 확인 실패", { userId: args.userId, error });
    return { tests: [], failedFiles: [], stopped: "budget-unavailable" };
  }

  const result = await generateEach<GeneratedPullRequestTest>({
    files: sources.map((file) => file.filePath),
    concurrency: GENERATION_CONCURRENCY,
    deadline: args.deadline,
    callTimeoutMs: CALL_TIMEOUT_MS,
    generate: async (filePath, index, signal) => {
      const generated = await generateTestCode({
        userId: args.userId,
        projectId: args.projectId,
        filePath,
        source: sources[index].source,
        testFramework: args.testFramework,
        dependencies: args.dependencies,
        // 레포에 이미 있는 foo.test.tsx 를 덮어쓰지 않게 따로 이름 붙인다.
        testPath: pullRequestTestPathFor(filePath),
        abortSignal: signal,
      });
      if (!generated) return { kind: "budget-exceeded" };
      return { kind: "generated", value: { filePath, ...generated } };
    },
    onError: (filePath, error) => {
      console.error("[pr-test-generation] 테스트 생성 실패", { filePath, error });
    },
  });

  if (result.skippedForDeadline > 0) {
    console.warn("[pr-test-generation] 마감이 지나 남은 파일을 건너뜀", {
      skipped: result.skippedForDeadline,
    });
  }

  return {
    tests: result.generated,
    failedFiles: result.failedFiles,
    stopped: result.budgetExceeded ? "budget-exceeded" : null,
  };
}

/**
 * 이 작업에서 만든 테스트를 저장한다.
 *
 * 같은 커밋을 Re-run 하면 같은 작업 행을 다시 쓰므로(pull-request-job.ts), 전에 저장한
 * 테스트를 지우고 새로 넣는다. 이번에 만들지 않은 파일의 옛 테스트가 남으면 preview 와
 * 실행 결과가 어긋난다.
 */
export async function savePullRequestTests(args: {
  jobId: string;
  projectId: string;
  framework: string | null;
  tests: GeneratedPullRequestTest[];
}) {
  await prisma.$transaction([
    prisma.pullRequestTest.deleteMany({ where: { jobId: args.jobId } }),
    prisma.pullRequestTest.createMany({
      data: args.tests.map((test) => ({
        jobId: args.jobId,
        projectId: args.projectId,
        filePath: test.filePath,
        testPath: test.testPath,
        code: test.code,
        framework: args.framework,
      })),
    }),
  ]);
}
