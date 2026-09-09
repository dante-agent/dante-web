// 지원하는 테스트 러너.
//
// Prisma 에서 enum 이 아니라 String 으로 둔 이유는 값이 자주 늘기 때문이다
// (vitest/jest → playwright/cypress). 대신 앱에서는 이 목록으로 좁혀 쓴다.

export const TEST_FRAMEWORKS = [
  {
    id: "vitest",
    name: "Vitest",
    tagline: "Vite 기반. ESM·TypeScript 를 설정 없이 그대로 읽는다.",
    /** 이 러너를 골랐을 때 만들어질 파일 모양 — 고르기 전에 결과를 보여준다. */
    example: "src/utils/format.test.ts",
  },
  {
    id: "jest",
    name: "Jest",
    tagline: "가장 널리 쓰인다. CRA·Next 기본 예제가 이 형식이다.",
    example: "src/utils/__tests__/format.test.ts",
  },
] as const;

export type TestFrameworkId = (typeof TEST_FRAMEWORKS)[number]["id"];

export function isTestFramework(value: string): value is TestFrameworkId {
  return TEST_FRAMEWORKS.some((framework) => framework.id === value);
}
