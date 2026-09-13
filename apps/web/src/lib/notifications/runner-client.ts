import type { RunnerFramework } from "@/lib/notifications/runner-request";

// ⚠️ 서버 전용. runner(apps/runner) 의 POST /runs 를 부른다.
//
// 타입을 apps/runner 에서 import 하지 않고 여기 다시 적는 이유: 두 앱은 따로 배포되고
// web 은 runner 패키지에 의존하지 않는다. 모양이 바뀌면 apps/runner/src/run.ts 와 같이 고친다.

export type RunnerRequest = {
  repo: { url: string; revision: string; token: string };
  testFiles: { path: string; content: string }[];
  framework: RunnerFramework;
  commands: { install: string; test: string };
  timeoutMs: number;
};

export type RunnerResult = {
  status: "passed" | "failed" | "error";
  exitCode: number | null;
  logs: string;
  errorMessage?: string;
  report: {
    totals: { total: number; passed: number; failed: number };
    failures: { file: string; name: string; message: string | null }[];
    files: { file: string; total: number; passed: number; failed: number }[];
  } | null;
  startedAt: string;
  finishedAt: string;
};

/**
 * 응답을 기다리는 여유. runner 는 동기로 돌고 샌드박스 준비·클론에 명령 상한과 별개로
 * 시간이 든다(runner 도 샌드박스 수명을 명령 상한 + 1분으로 잡는다).
 */
const RESPONSE_GRACE_MS = 2 * 60 * 1000;

/** runner 가 설정됐는지. 로컬·프리뷰에서 runner 없이 생성까지만 돌릴 수 있게 따로 묻는다. */
export function isRunnerConfigured() {
  return Boolean(process.env.RUNNER_URL && process.env.RUNNER_SECRET);
}

/** runner 에 실행을 맡기고 결과를 받는다. 연결 실패·401·400 은 던진다. */
export async function callRunner(request: RunnerRequest): Promise<RunnerResult> {
  const url = process.env.RUNNER_URL;
  const secret = process.env.RUNNER_SECRET;
  if (!url || !secret)
    throw new Error("RUNNER_URL / RUNNER_SECRET 가 없습니다. .env.example 참고.");

  const response = await fetch(new URL("/runs", url), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(request.timeoutMs + RESPONSE_GRACE_MS),
  });

  if (!response.ok) {
    throw new Error(`runner ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  return (await response.json()) as RunnerResult;
}
