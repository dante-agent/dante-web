import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTestTarget } from "./test-targets.ts";

// 설정·테스트 준비 파일이 추천에서 빠지는지 본다. 실행: pnpm --filter @dante/web test

describe("isTestTarget", () => {
  it("도구 설정·rc·테스트 준비 파일은 대상이 아니다", () => {
    for (const path of [
      "eslint.config.js",
      "vite.config.ts",
      "apps/web/next.config.mjs",
      "vitest.config.e2e.mts",
      "postcss.config.cjs",
      ".eslintrc.js",
      "packages/ui/.prettierrc.cjs",
      "vitest.setup.ts",
      "src/setupTests.tsx",
    ]) {
      assert.equal(isTestTarget(path), false, path);
    }
  });

  it("앱 코드는 이름에 config·setup 이 들어가도 대상이다", () => {
    for (const path of [
      "src/App.tsx",
      "src/lib/config.ts",
      "src/features/app-config.tsx",
      "src/hooks/useSetup.ts",
      "src/config/routes.ts",
      "src/lib/configureStore.ts",
    ]) {
      assert.equal(isTestTarget(path), true, path);
    }
  });
});
