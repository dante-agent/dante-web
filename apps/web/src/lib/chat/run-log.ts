// 채팅 컨텍스트에 붙이는 "현재 테스트의 마지막 실행". 순수 함수다.
//
// 사용자가 "터미널 오류 보고 고쳐줘"라고 할 때 모델이 로그 없이 추측하지 않게 한다.
// 세션 상세의 Regenerate & retry(recommend/actions.ts)와 같은 규칙으로 로그 끝만 싣는다.

/** 싣는 로그 상한(글자). 실패 원인은 대개 로그 끝에 있어 뒤에서 자른다. */
export const MAX_RUN_LOG = 6_000;

// vitest/jest 로그의 색상 코드(SGR). 모델에는 의미 없는 토큰이다.
const ANSI_SGR = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

export type LastRun = {
  status: string;
  logs: string | null;
  errorMessage: string | null;
};

/** <run_log> 블록. 통과한 실행은 로그 없이 결과만 적는다 — 고칠 근거가 아니라 토큰만 쓴다. */
export function runLogBlock(run: LastRun): string {
  if (run.status === "passed") return "The last run of this test passed.";

  const raw = (run.logs ?? run.errorMessage ?? "").replace(ANSI_SGR, "").trimEnd();
  // 로그도 레포 코드가 찍은 출력이다 — 태그를 닫고 지시문 자리로 빠져나가지 못하게 한다.
  const body = (raw.slice(-MAX_RUN_LOG) || "(no logs captured)").replace(
    /<\/run_log/gi,
    "<\\/run_log"
  );
  const outcome = run.status === "error" ? "could not run" : "failed";
  return `The last run of this test ${outcome}:\n<run_log>\n${body}\n</run_log>`;
}
