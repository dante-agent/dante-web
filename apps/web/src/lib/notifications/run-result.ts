import type { ComponentChange, RunSummary } from "./run-summary.ts";

// 생성·실행 결과 → PR 에 되돌려줄 RunSummary. 순수 함수다.
//
// 코멘트·체크는 RunSummary 만 본다(run-summary.ts). runner 응답을 그대로 흘려보내지 않고
// 여기서 한 번 접는 이유는 "테스트가 깨졌다"와 "우리가 못 돌렸다"를 가르는 자리가 하나여야
// 해서다. 둘을 섞으면 install 이 깨진 PR 에 "테스트 실패"가 찍힌다.

/** 컴포넌트와 그 컴포넌트가 들어 있는 소스 파일. 테스트 수를 파일 단위로 붙인다 */
export type LocatedComponent = ComponentChange & { filePath: string };

export type GeneratedTestFile = { filePath: string; testPath: string };

export type GenerationOutcome = {
  tests: GeneratedTestFile[];
  failedFiles: string[];
  stopped: "budget-exceeded" | "budget-unavailable" | null;
};

/** runner 응답 중 여기서 쓰는 필드만 (runner-client.ts 의 RunnerResult 와 같은 모양) */
export type RunnerOutcome = {
  status: "passed" | "failed" | "error";
  errorMessage?: string;
  report: {
    totals: { total: number; passed: number; failed: number };
    failures: { file: string; name: string; message: string | null }[];
    /** 파일별 개수. 옛 runner 는 주지 않는다 */
    files?: { file: string; total: number }[];
  } | null;
  startedAt: string;
  finishedAt: string;
};

export type TestRunOutcome =
  | { kind: "ran"; result: RunnerOutcome }
  | { kind: "not-run"; reason: "no-tests" | "no-framework" | "runner-not-configured" };

export function finalRun(
  base: RunSummary,
  args: {
    components: LocatedComponent[];
    generation: GenerationOutcome;
    testRun: TestRunOutcome;
  }
): RunSummary {
  const components = args.components.map(({ name, change }) => ({ name, change, tests: 0 }));
  const { generation, testRun } = args;

  if (testRun.kind === "not-run") {
    if (testRun.reason === "no-framework") {
      return {
        ...base,
        status: "skipped",
        components,
        skipReason: "This project has no test runner picked in Dante, so it did not run tests.",
      };
    }
    if (testRun.reason === "runner-not-configured") {
      return {
        ...base,
        status: "skipped",
        components,
        skipReason: "Dante's test runner is not set up on this server, so it did not run tests.",
      };
    }
    // 만든 테스트가 하나도 없다. 한도로 멈췄으면 작성자가 할 일이 있고, 아니면 우리 쪽 실패다.
    if (generation.stopped === "budget-exceeded") {
      return {
        ...base,
        status: "skipped",
        components,
        skipReason:
          "The author ran out of this month's AI budget, so Dante skipped test generation.",
      };
    }
    return {
      ...base,
      status: "failed",
      components,
      error: "Dante could not generate tests for the changed components.",
    };
  }

  const { result } = testRun;
  const durationMs = Math.max(0, Date.parse(result.finishedAt) - Date.parse(result.startedAt));

  // 리포트 없이는 몇 개가 통과했는지 모른다. "passed" 여도 0/0 으로 적으면 모두 통과로 읽힌다.
  if (result.status === "error" || result.report === null) {
    return {
      ...base,
      status: "failed",
      components,
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
      error: result.errorMessage ?? "The runner stopped before any tests were reported.",
    };
  }

  const testsByFile = new Map<string, number>();
  for (const file of result.report.files ?? []) testsByFile.set(file.file, file.total);
  const testPathBySource = new Map(generation.tests.map((test) => [test.filePath, test.testPath]));

  return {
    ...base,
    status: "completed",
    totals: result.report.totals,
    failures: result.report.failures,
    // 한 파일에 컴포넌트가 여럿이면 테스트 파일도 하나라 같은 수가 붙는다.
    components: args.components.map(({ name, change, filePath }) => {
      const testPath = testPathBySource.get(filePath);
      return { name, change, tests: testPath ? (testsByFile.get(testPath) ?? 0) : 0 };
    }),
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
  };
}
