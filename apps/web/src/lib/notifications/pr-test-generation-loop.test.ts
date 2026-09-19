import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateEach, type FileGeneration } from "./pr-test-generation-loop.ts";

// PR 테스트 생성의 동시 실행·마감 규칙. 실행: pnpm --filter @dante/web test
// 모델 호출 대신 signal 을 따르는 느린 가짜를 넣는다.

const files = ["a.tsx", "b.tsx", "c.tsx", "d.tsx", "e.tsx"];

/** ms 뒤에 끝나고, signal 이 끊기면 그 자리에서 던지는 가짜 호출 */
function slow(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

const run = (overrides: Partial<Parameters<typeof generateEach<string>>[0]> = {}) =>
  generateEach<string>({
    files,
    concurrency: 2,
    deadline: Date.now() + 60_000,
    callTimeoutMs: 60_000,
    generate: async (filePath, _index, signal): Promise<FileGeneration<string>> => {
      await slow(5, signal);
      return { kind: "generated", value: filePath };
    },
    onError: () => {},
    ...overrides,
  });

describe("generateEach", () => {
  it("동시에 concurrency 개까지만 돌리고 결과는 입력 순서다", async () => {
    let running = 0;
    let peak = 0;
    const result = await run({
      generate: async (filePath, index, signal) => {
        running += 1;
        peak = Math.max(peak, running);
        // 뒤 파일이 먼저 끝나게 해 순서가 입력을 따르는지 본다.
        await slow(20 - index * 3, signal);
        running -= 1;
        return { kind: "generated", value: filePath };
      },
    });
    assert.equal(peak, 2);
    assert.deepEqual(result.generated, files);
    assert.deepEqual(result.failedFiles, []);
  });

  it("마감이 지나면 돌던 호출을 끊고 남은 파일은 시작하지 않고 끝난다", async () => {
    const started: string[] = [];
    const began = Date.now();
    const result = await run({
      deadline: Date.now() + 50,
      generate: async (filePath, _index, signal) => {
        started.push(filePath);
        await slow(10_000, signal);
        return { kind: "generated", value: filePath };
      },
    });
    assert.ok(Date.now() - began < 1_000, "마감 직후 끝나야 한다");
    assert.deepEqual(started, ["a.tsx", "b.tsx"]);
    assert.deepEqual(result.generated, []);
    assert.deepEqual(result.failedFiles, files);
    assert.equal(result.skippedForDeadline, 3);
    assert.equal(result.budgetExceeded, false);
  });

  it("호출 하나의 상한을 넘으면 그 파일만 실패로 센다", async () => {
    const result = await run({
      callTimeoutMs: 30,
      generate: async (filePath, _index, signal) => {
        await slow(filePath === "c.tsx" ? 10_000 : 5, signal);
        return { kind: "generated", value: filePath };
      },
    });
    assert.deepEqual(result.generated, ["a.tsx", "b.tsx", "d.tsx", "e.tsx"]);
    assert.deepEqual(result.failedFiles, ["c.tsx"]);
    assert.equal(result.skippedForDeadline, 0);
  });

  it("한도에 막히면 새 파일을 시작하지 않고, 돌던 호출은 결과에 넣는다", async () => {
    const started: string[] = [];
    const result = await run({
      generate: async (filePath, _index, signal) => {
        started.push(filePath);
        if (filePath === "a.tsx") return { kind: "budget-exceeded" };
        await slow(20, signal);
        return { kind: "generated", value: filePath };
      },
    });
    assert.deepEqual(started, ["a.tsx", "b.tsx"]);
    assert.deepEqual(result.generated, ["b.tsx"]);
    assert.deepEqual(result.failedFiles, []);
    assert.equal(result.budgetExceeded, true);
  });

  it("던진 호출은 실패로 세고 onError 로 알린다", async () => {
    const errors: string[] = [];
    const result = await run({
      generate: async (filePath) => {
        if (filePath === "b.tsx") throw new Error("boom");
        return { kind: "generated", value: filePath };
      },
      onError: (filePath) => errors.push(filePath),
    });
    assert.deepEqual(errors, ["b.tsx"]);
    assert.deepEqual(result.failedFiles, ["b.tsx"]);
    assert.equal(result.generated.length, 4);
  });
});
