import type { TestFrameworkId } from "@/lib/projects/frameworks";

// 실행 환경 설정값의 모양·기본값·검증. runner 가 샌드박스에서 그대로 실행하는
// 값이다 (docs/adr/0001-test-runtime.md).
//
// DB 컬럼이 null 일 수 있다는 게 이 파일의 존재 이유다. 프로젝트를 만들 때
// 미리 채우지 않기 때문에(기본값을 바꾸면 기존 행을 전부 손봐야 한다) "없음"을
// 늘 기본값으로 접어야 하고, 그 접는 자리가 여기다.
//
// DB 도 GitHub 도 부르지 않는 순수 값만 둔다 — 화면이 이 파일을 import 한다.

export interface RuntimeSettings {
  installCommand: string;
  testCommand: string;
  timeoutMs: number;
}

/** 저장된 값이 없을 때 쓰는 상한. runner 의 기본값과 같다. */
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * runner 가 받아주는 범위. 여기서 한 번 좁혀도 runner 가 다시 좁힌다 —
 * 설정 화면을 우회해 저장된 값이 있어도 샌드박스가 무한정 돌지 않게.
 */
export const MIN_TIMEOUT_MS = 30 * 1000;
export const MAX_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * 러너별 기본 커맨드.
 *
 * 패키지 매니저를 pnpm 으로 박지 않고 npm 으로 두는 이유: 사용자 레포가 무엇을
 * 쓰는지 우리는 모른다. npm 은 Node 이미지에 항상 있고 lockfile 이 없어도 돈다.
 * pnpm 을 쓰는 레포라면 이 칸을 고치면 된다 — 그러라고 있는 화면이다.
 */
const DEFAULT_COMMANDS: Record<TestFrameworkId, { install: string; test: string }> = {
  vitest: { install: "npm install", test: "npx vitest run" },
  jest: { install: "npm install", test: "npx jest --ci" },
};

/** 러너를 아직 안 골랐을 때. 온보딩을 끝냈으면 testFramework 는 채워져 있다. */
const FALLBACK_COMMANDS = { install: "npm install", test: "npm test" };

/** DB 행(일부 null)을 화면·runner 가 쓸 완전한 값으로 접는다. */
export function resolveRuntimeSettings(project: {
  testFramework: string | null;
  installCommand: string | null;
  testCommand: string | null;
  testTimeoutMs: number | null;
}): RuntimeSettings {
  const defaults = defaultCommands(project.testFramework);
  return {
    installCommand: project.installCommand ?? defaults.install,
    testCommand: project.testCommand ?? defaults.test,
    timeoutMs: project.testTimeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

/** 화면이 placeholder 로 쓴다 — 비워두면 무엇이 돌게 되는지 보여주려고. */
export function defaultCommands(testFramework: string | null) {
  if (testFramework && testFramework in DEFAULT_COMMANDS) {
    return DEFAULT_COMMANDS[testFramework as TestFrameworkId];
  }
  return FALLBACK_COMMANDS;
}

/** 화면에 "5 min" 처럼 띄운다. 밀리초를 그대로 보여주면 아무도 못 읽는다. */
export function formatTimeout(ms: number) {
  const minutes = ms / 60_000;
  return Number.isInteger(minutes) ? `${minutes} min` : `${Math.round(ms / 1000)} s`;
}

export const TIMEOUT_CHOICES = [1, 3, 5, 10, 15].map((minutes) => ({
  value: minutes * 60_000,
  label: `${minutes} min`,
}));

export type RuntimeFieldError = {
  field: "installCommand" | "testCommand" | "timeoutMs";
  message: string;
};

/**
 * 폼에서 온 값 검증. 커맨드는 사용자가 쓴 셸 명령이라 내용을 판단하지 않는다 —
 * 어차피 격리된 샌드박스 안에서만 돌고, 무엇이 옳은 명령인지는 레포마다 다르다.
 * 여기서 막는 건 "비었거나 터무니없이 긴" 정도다.
 */
export function validateRuntimeInput(input: {
  installCommand: string;
  testCommand: string;
  timeoutMs: number;
}): RuntimeFieldError | null {
  if (input.installCommand.trim() === "") {
    return { field: "installCommand", message: "Install command cannot be empty." };
  }
  if (input.testCommand.trim() === "") {
    return { field: "testCommand", message: "Test command cannot be empty." };
  }
  if (input.installCommand.length > 500 || input.testCommand.length > 500) {
    return {
      field: input.installCommand.length > 500 ? "installCommand" : "testCommand",
      message: "Commands are capped at 500 characters.",
    };
  }
  if (
    !Number.isInteger(input.timeoutMs) ||
    input.timeoutMs < MIN_TIMEOUT_MS ||
    input.timeoutMs > MAX_TIMEOUT_MS
  ) {
    return {
      field: "timeoutMs",
      message: `Timeout must be between ${formatTimeout(MIN_TIMEOUT_MS)} and ${formatTimeout(MAX_TIMEOUT_MS)}.`,
    };
  }
  return null;
}
