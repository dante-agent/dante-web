import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXED_LABEL, FIXED_NOTE, sessionLabel, UPDATED_NOTE } from "./session-label.ts";

// 사이드바 세션 제목이 "이 버전을 만든 요청"을 가리키는지 본다. 실행: pnpm --filter @dante/web test

const user = (text: string) => ({ role: "user" as const, text });
const assistant = (text: string) => ({ role: "assistant" as const, text });

describe("sessionLabel", () => {
  it("프롬프트로 생성한 버전은 프롬프트가 제목이다", () => {
    const messages = [
      user("유틸 함수 테스트 만들어줘"),
      assistant("These files match.\n\n• src/a.ts\n\nGenerate a test for the file above?"),
      assistant("Generated 1 test file. Opening the session now…"),
    ];
    assert.equal(sessionLabel(messages), "유틸 함수 테스트 만들어줘");
  });

  it("후속 요청으로 만든 버전은 그 요청이 제목이다", () => {
    const messages = [
      user("Generate tests for Counter.tsx"),
      assistant("Generated `src/components/Counter.test.tsx`. Review it on the right."),
      user("Add one test for decrement below zero"),
      assistant(UPDATED_NOTE),
    ];
    assert.equal(sessionLabel(messages), "Add one test for decrement below zero");
  });

  it("이 세션에서 나중에 보낸 요청은 이 버전의 제목을 바꾸지 않는다", () => {
    // v5 에서 후속 요청을 보내면 v5 대화 끝에도 그 요청이 저장된다. 제목은 v5 를 만든 요청 그대로.
    const messages = [
      user("Generate tests for Counter.tsx"),
      assistant("Generated `src/components/Counter.test.tsx`. Review it on the right."),
      user("Add one test for decrement below zero"),
      assistant("Update failed. Check your API key and AI settings."),
    ];
    assert.equal(sessionLabel(messages), "Generate tests for Counter.tsx");
  });

  it("실패 재생성으로 만든 버전은 고정 제목이다 (예전 알림 문구 포함)", () => {
    const base = [user("Generate tests for Counter.tsx"), assistant("Generated `a.test.tsx`.")];
    assert.equal(sessionLabel([...base, assistant(FIXED_NOTE)]), FIXED_LABEL);
    assert.equal(
      sessionLabel([
        ...base,
        assistant("Fixed the test based on the failure logs, and re-running it now."),
      ]),
      FIXED_LABEL
    );
  });

  it("요청 없이 생성 알림만 있거나 대화가 없으면 null", () => {
    assert.equal(sessionLabel([assistant("Generated 3 test files from your selection.")]), null);
    assert.equal(sessionLabel([]), null);
  });

  it("줄바꿈·연속 공백은 한 칸으로 접고 길면 자른다", () => {
    const long = `Test the form\n\n  validation ${"x".repeat(200)}`;
    const label = sessionLabel([user(long), assistant("Generated 1 test file.")]);
    assert.ok(label?.startsWith("Test the form validation x"));
    assert.equal(label?.length, 80);
  });
});
