// 대시보드 Pull requests 줄 하나의 상태·결과 문구. 순수 함수다.
//
// PullRequestJob.status 는 파이프라인 단계라 그대로 보이면 읽기 어렵다. 사람이 볼 다섯 가지로 접는다.

import { readStoredRun } from "../notifications/stored-run.ts";

/** skipped = 끝났지만 돌릴 테스트가 없었던 커밋(바뀐 컴포넌트가 없는 등). 통과로 보이면 안 된다. */
export type PullRequestTone = "running" | "passed" | "failed" | "error" | "skipped";

export type PullRequestResult = { tone: PullRequestTone; label: string; note: string };

const LABEL: Record<PullRequestTone, string> = {
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  error: "Error",
  skipped: "Skipped",
};

function tests(count: number) {
  return `${count} ${count === 1 ? "test" : "tests"}`;
}

/** superseded(새 커밋이 대신한 작업)는 목록에서 빼므로 여기 오지 않는다고 본다. */
export function pullRequestResult(job: {
  status: string;
  error: string | null;
  runResult: unknown;
}): PullRequestResult {
  const result = (tone: PullRequestTone, note: string) => ({ tone, label: LABEL[tone], note });

  if (job.status === "queued" || job.status === "running") {
    return result("running", "Generating tests");
  }
  if (job.status === "awaiting_run" || job.status === "testing") {
    return result("running", "Running tests");
  }
  if (job.status === "failed") {
    // 에러 원문은 여러 줄일 수 있다. 한 줄로 보이도록 첫 줄만.
    return result("error", job.error?.split("\n")[0]?.trim() || "Something went wrong");
  }

  const run = readStoredRun(job.runResult);
  if (!run) return result("skipped", "No tests ran for this commit");
  if (run.status === "error") return result("error", run.errorMessage ?? "The run did not finish");
  if (!run.totals) return result(run.status, run.status === "passed" ? "Passed" : "Failed");

  const { total, failed } = run.totals;
  return failed > 0
    ? result("failed", `${failed} of ${tests(total)} failed`)
    : result("passed", `${total} of ${tests(total)} passed`);
}
