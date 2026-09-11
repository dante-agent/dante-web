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

export interface RuntimeCommands {
  install: string;
  test: string;
  /**
   * "repo" = 레포의 lockfile·package.json 을 보고 정했다.
   * "fallback" = 레포를 못 읽어서 아무 프로젝트에나 맞는 값으로 떨어졌다.
   *
   * 화면이 이 둘을 구분해 말해줘야 한다. 레포를 못 읽었는데 자신 있게 기본값을
   * 보여주면, 사용자는 그게 자기 레포에 맞춘 값인 줄 알고 그대로 저장한다.
   */
  source: "repo" | "fallback";
}

/**
 * 러너별 테스트 커맨드. 레포에 `scripts.test` 가 없을 때만 쓴다.
 *
 * 패키지 매니저는 여기서 정하지 않는다 — 레포의 lockfile 을 보고 정한다
 * (`detect-runtime.ts`). `npx` 는 어느 매니저를 쓰든 도는 호출이라, 러너만
 * 아는 이 자리에서 고를 수 있는 가장 안전한 형태다.
 */
const FRAMEWORK_TEST_COMMANDS: Record<TestFrameworkId, string> = {
  vitest: "npx vitest run",
  jest: "npx jest --ci",
};

/**
 * 레포를 못 읽었을 때의 최후 기본값.
 *
 * `npm install` 인 이유: `npm ci` 는 lockfile 이 없으면 실패하는데, 여기까지
 * 왔다는 건 레포에 무엇이 있는지 모른다는 뜻이다. 실패하는 기본값보다
 * 헐거운 기본값이 낫다.
 */
export const FALLBACK_COMMANDS: RuntimeCommands = {
  install: "npm install",
  test: "npm test",
  source: "fallback",
};

export function frameworkTestCommand(testFramework: string | null): string {
  if (testFramework && testFramework in FRAMEWORK_TEST_COMMANDS) {
    return FRAMEWORK_TEST_COMMANDS[testFramework as TestFrameworkId];
  }
  return FALLBACK_COMMANDS.test;
}

/** DB 행(일부 null)을 화면·runner 가 쓸 완전한 값으로 접는다. */
export function resolveRuntimeSettings(
  project: {
    installCommand: string | null;
    testCommand: string | null;
    testTimeoutMs: number | null;
  },
  /** 레포에서 알아낸 기본값 (`detectRuntimeCommands`). */
  defaults: RuntimeCommands
): RuntimeSettings {
  return {
    installCommand: project.installCommand ?? defaults.install,
    testCommand: project.testCommand ?? defaults.test,
    timeoutMs: project.testTimeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
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
