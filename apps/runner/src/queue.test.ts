import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSerialQueue } from "./queue.ts";

// 실행을 하나씩 돌리는 규칙. 실행: pnpm --filter @dante/runner test

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("createSerialQueue", () => {
  it("한 번에 하나만 돌리고 들어온 순서대로 돌린다", async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    let running = 0;
    let maxRunning = 0;

    const task = (name: string) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      events.push(`start ${name}`);
      await tick();
      events.push(`end ${name}`);
      running--;
      return name;
    };

    const results = await Promise.all([
      queue.run(task("a")),
      queue.run(task("b")),
      queue.run(task("c")),
    ]);

    assert.deepEqual(results, ["a", "b", "c"]);
    assert.equal(maxRunning, 1);
    assert.deepEqual(events, ["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("앞 작업이 실패해도 뒤 작업은 돈다", async () => {
    const queue = createSerialQueue();
    const failed = queue.run(async () => {
      throw new Error("boom");
    });
    const next = queue.run(async () => "ok");

    await assert.rejects(failed, /boom/);
    assert.equal(await next, "ok");
  });

  it("size 는 돌고 있는 것과 기다리는 것을 센다", async () => {
    const queue = createSerialQueue();
    assert.equal(queue.size, 0);

    const first = queue.run(tick);
    const second = queue.run(tick);
    assert.equal(queue.size, 2);

    await Promise.all([first, second]);
    assert.equal(queue.size, 0);
  });
});
