// 테스트 한 번을 Vercel Sandbox 에서 돌리는 함수 (docs/adr/0002-run-sandbox-from-web.md).
//
// 샌드박스 제공자를 바꾸더라도 부르는 쪽(web)은 이 입구만 본다.

export { runTest, type RunRequest, type RunResult } from "./run.ts";
export { type FailedTest, type TestFramework, type TestReport } from "./report.ts";
