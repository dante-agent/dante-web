import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runnerFramework, withPassThroughArgs } from "./runner-request.ts";

describe("runnerFramework", () => {
  it("vitest·jest 만 받는다", () => {
    assert.equal(runnerFramework("vitest"), "vitest");
    assert.equal(runnerFramework("jest"), "jest");
    assert.equal(runnerFramework("mocha"), null);
    assert.equal(runnerFramework(null), null);
  });
});

describe("withPassThroughArgs", () => {
  it("npm 스크립트 호출에는 -- 를 붙인다", () => {
    assert.equal(withPassThroughArgs("npm run test"), "npm run test --");
    assert.equal(withPassThroughArgs("npm test"), "npm test --");
    assert.equal(withPassThroughArgs("  npm run-script unit "), "npm run-script unit --");
  });

  it("이미 -- 가 있으면 그대로 둔다", () => {
    assert.equal(withPassThroughArgs("npm test --"), "npm test --");
    assert.equal(withPassThroughArgs("npm test -- --silent"), "npm test -- --silent");
  });

  it("인자를 넘기는 매니저와 직접 호출은 손대지 않는다", () => {
    assert.equal(withPassThroughArgs("pnpm test"), "pnpm test");
    assert.equal(withPassThroughArgs("yarn test"), "yarn test");
    assert.equal(withPassThroughArgs("npx vitest run"), "npx vitest run");
  });
});
