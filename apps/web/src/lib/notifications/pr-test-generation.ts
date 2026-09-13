import { prisma } from "@dante/db";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import { generateTestCode } from "@/lib/projects/test-generation";

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
  /** AI 호출이 실패한 파일 */
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
 * 파일을 하나씩 차례로 만든다.
 *
 * 동시에 부르지 않는 이유: 한도 검사는 호출 전, 기록은 호출 후라(budget.ts 의 "경합")
 * 한꺼번에 보내면 한도를 넘은 뒤에도 전부 나간다. 파일마다 다시 보고 넘었으면 멈춘다.
 */
export async function generatePullRequestTests(args: {
  userId: string;
  projectId: string;
  testFramework: string | null;
  sources: PullRequestSource[];
}): Promise<PullRequestGeneration> {
  const result: PullRequestGeneration = { tests: [], failedFiles: [], stopped: null };

  for (const { filePath, source } of args.sources.slice(0, MAX_FILES_TO_GENERATE)) {
    try {
      const budget = await getMonthlyBudgetStatus(args.userId);
      if (budget.exceeded) return { ...result, stopped: "budget-exceeded" };
    } catch (error) {
      console.error("[pr-test-generation] 한도 확인 실패", { userId: args.userId, error });
      return { ...result, stopped: "budget-unavailable" };
    }

    try {
      const { testPath, code } = await generateTestCode({
        userId: args.userId,
        projectId: args.projectId,
        filePath,
        source,
        testFramework: args.testFramework,
      });
      result.tests.push({ filePath, testPath, code });
    } catch (error) {
      console.error("[pr-test-generation] 테스트 생성 실패", { filePath, error });
      result.failedFiles.push(filePath);
    }
  }

  return result;
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
