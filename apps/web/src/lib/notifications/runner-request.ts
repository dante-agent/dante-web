// 샌드박스 실행(packages/sandbox)에 보낼 값을 다듬는 규칙. 순수 함수다.

export type RunnerFramework = "vitest" | "jest";

/** 프로젝트의 testFramework 중 샌드박스 실행이 받는 값만. 고르지 않았거나 모르는 값이면 null */
export function runnerFramework(value: string | null): RunnerFramework | null {
  return value === "vitest" || value === "jest" ? value : null;
}

/**
 * 샌드박스 실행은 테스트 커맨드 뒤에 파일 경로와 리포트 플래그를 붙인다
 * (packages/sandbox/report.ts 의 buildTestCommand).
 *
 * npm 은 `--` 없이 붙은 플래그를 자기 옵션으로 먹어서 러너에 안 넘긴다. Runtime 탭의
 * 기본값은 `scripts.test` 가 있으면 `npm run test` 라 그대로 보내면 리포트가 안 생긴다.
 * 그래서 npm 스크립트 호출로 끝나는 커맨드에만 `--` 를 붙인다. pnpm·yarn·bun 은 인자를
 * 그대로 넘기므로 손대지 않는다.
 */
export function withPassThroughArgs(command: string): string {
  const trimmed = command.trim();
  if (/\s--(\s|$)/.test(trimmed)) return trimmed;
  if (/^npm\s+(test|t|run(-script)?\s+\S+)$/.test(trimmed)) return `${trimmed} --`;
  return trimmed;
}
