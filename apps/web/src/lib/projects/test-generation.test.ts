import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TestRecommendation } from "./recommendations.ts";
import { cleanGeneratedCode, findSourceFromPrompt, testPathFor } from "./test-generation.ts";

const recommendations: TestRecommendation[] = [
  {
    id: "src/auth/login-form.tsx",
    componentName: "login-form",
    filePath: "src/auth/login-form.tsx",
    reason: "테스트 파일이 아직 없음",
    priority: "high",
  },
  {
    id: "src/ui/button.tsx",
    componentName: "button",
    filePath: "src/ui/button.tsx",
    reason: "테스트 파일이 아직 없음",
    priority: "low",
  },
];

describe("findSourceFromPrompt", () => {
  it("파일명으로 생성 대상을 찾는다", () => {
    assert.equal(
      findSourceFromPrompt("login-form의 실패 상태를 테스트해줘", recommendations)?.id,
      recommendations[0]?.id
    );
  });

  it("대상을 특정할 수 없으면 null을 반환한다", () => {
    assert.equal(findSourceFromPrompt("테스트를 만들어줘", recommendations), null);
  });
});

describe("testPathFor", () => {
  it("원본 확장자를 유지한 테스트 경로를 만든다", () => {
    assert.equal(testPathFor("src/auth/login-form.tsx"), "src/auth/login-form.test.tsx");
  });
});

describe("cleanGeneratedCode", () => {
  it("AI가 붙인 코드 펜스를 제거한다", () => {
    assert.equal(
      cleanGeneratedCode("```tsx\nexpect(true).toBe(true);\n```"),
      "expect(true).toBe(true);\n"
    );
  });
});
