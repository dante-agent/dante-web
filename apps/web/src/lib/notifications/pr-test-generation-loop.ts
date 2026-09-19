import { mapConcurrent } from "../map-concurrent.ts";

// PR 테스트 생성의 "몇 개씩, 언제까지" 규칙. 순수 함수라 node --test 로 바로 돈다.
// AI 호출·한도 예약은 generate 로 받는다(pr-test-generation.ts).

/** 파일 하나를 만든 결과. 한도에 막혔으면 budget-exceeded, 실패는 던진다 */
export type FileGeneration<T> = { kind: "generated"; value: T } | { kind: "budget-exceeded" };

export type GenerationLoopResult<T> = {
  /** 만든 것. 입력 순서 그대로다 */
  generated: T[];
  /** 호출이 실패했거나(시간 초과 포함) 마감이 지나 시작하지 못한 파일. 입력 순서 그대로다 */
  failedFiles: string[];
  /** 한도에 막혀 멈췄는지. 그 뒤 파일은 시작하지 않았고 failedFiles 에도 넣지 않는다 */
  budgetExceeded: boolean;
  /** 마감이 지나 시작하지 못한 파일 수. failedFiles 에 들어 있다 */
  skippedForDeadline: number;
};

type Outcome<T> =
  | { kind: "generated"; value: T }
  | { kind: "failed" }
  | { kind: "deadline" }
  | { kind: "not-started" };

/**
 * 파일마다 generate 를 부르되 동시에 concurrency 개까지만, deadline(epoch ms)까지만 돈다.
 *
 * 호출마다 signal 을 넘긴다. 호출 하나의 상한(callTimeoutMs)이나 전체 마감 중 먼저 오는 쪽에서 끊긴다.
 * 끊긴 호출은 던지므로 실패로 센다. 마감이 지난 뒤에는 새 파일을 시작하지 않는다 —
 * 함수가 라우트의 maxDuration 에 잘리면 작업이 "running" 으로 남으니, 그 전에 스스로 끝낸다.
 *
 * 한도에 한 번 막히면 새 파일을 시작하지 않는다. 이미 돌고 있는 호출은 한도를 예약하고 들어간
 * 것이라 끝까지 기다려 결과에 넣는다.
 */
export async function generateEach<T>(args: {
  files: readonly string[];
  concurrency: number;
  deadline: number;
  callTimeoutMs: number;
  generate: (filePath: string, index: number, signal: AbortSignal) => Promise<FileGeneration<T>>;
  onError: (filePath: string, error: unknown) => void;
}): Promise<GenerationLoopResult<T>> {
  const deadlineSignal = AbortSignal.timeout(Math.max(0, args.deadline - Date.now()));
  let budgetExceeded = false;

  const outcomes = await mapConcurrent(
    args.files,
    args.concurrency,
    async (filePath, index): Promise<Outcome<T>> => {
      if (budgetExceeded) return { kind: "not-started" };
      if (deadlineSignal.aborted || Date.now() >= args.deadline) return { kind: "deadline" };

      try {
        const signal = AbortSignal.any([AbortSignal.timeout(args.callTimeoutMs), deadlineSignal]);
        const result = await args.generate(filePath, index, signal);
        if (result.kind === "budget-exceeded") {
          budgetExceeded = true;
          return { kind: "not-started" };
        }
        return result;
      } catch (error) {
        args.onError(filePath, error);
        return { kind: "failed" };
      }
    }
  );

  const generated: T[] = [];
  const failedFiles: string[] = [];
  let skippedForDeadline = 0;
  outcomes.forEach((outcome, index) => {
    if (outcome.kind === "generated") generated.push(outcome.value);
    if (outcome.kind === "failed" || outcome.kind === "deadline")
      failedFiles.push(args.files[index]);
    if (outcome.kind === "deadline") skippedForDeadline += 1;
  });

  return { generated, failedFiles, budgetExceeded, skippedForDeadline };
}
