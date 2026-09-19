import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeRepo,
  analyzeSource,
  createResolver,
  parseImports,
  stripCode,
} from "./code-analysis.ts";

// 실행: pnpm --filter @dante/web test

describe("stripCode", () => {
  it("주석을 지우고 줄바꿈은 남긴다", () => {
    assert.equal(stripCode("a // if\n/* if\n */b", "blank"), "a \n\nb");
  });

  it("blank 면 문자열 내용을 지운다", () => {
    assert.equal(stripCode(`x = "if (a && b)"`, "blank"), `x = ""`);
  });

  it("정규식 안의 따옴표를 문자열로 읽지 않는다", () => {
    const code = stripCode(`const re = /['"]/g; if (a) {}`, "blank");
    assert.match(code, /if \(a\)/);
  });

  it("나눗셈은 정규식으로 읽지 않는다", () => {
    assert.equal(stripCode(`a / b / "x"`, "blank"), `a / b / ""`);
  });
});

describe("analyzeSource", () => {
  it("분기를 센다", () => {
    const src = `
      function f(a, b) {
        if (a && b) return 1;          // if, &&
        for (const x of b) {}          // for
        switch (a) { case 1: break; }  // case
        try {} catch {}                // catch
        return a ? b : a ?? 0;         // ?, ??
      }`;
    assert.equal(analyzeSource(src).branches, 7);
  });

  it("옵셔널 체이닝·옵셔널 속성은 분기가 아니다", () => {
    const src = `type P = { a?: string };\nconst f = (p: P) => p.a?.length;`;
    assert.equal(analyzeSource(src).branches, 0);
  });

  it("타입만 있는 파일은 로직이 없다", () => {
    const src = `export type Fn = (a: string) => void;\nexport interface X { f: () => void }`;
    assert.equal(analyzeSource(src).hasLogic, false);
  });

  it("함수가 있으면 로직이 있다", () => {
    assert.equal(analyzeSource(`export const f = () => 1;`).hasLogic, true);
  });

  it("다시 내보내기만 하면 배럴이다", () => {
    const src = `export * from "./a";\nexport { b } from "./b";\nimport "./c";`;
    assert.equal(analyzeSource(src).barrel, true);
    assert.equal(analyzeSource(`export { b } from "./b";\nexport const x = 1;`).barrel, false);
  });

  it("주석·빈 줄은 줄 수에서 뺀다", () => {
    assert.equal(analyzeSource(`// c\n\nconst a = 1;\n/* x\ny */\nconst b = 2;\n`).lines, 2);
  });
});

describe("parseImports", () => {
  it("여러 형태의 import 를 모은다", () => {
    const src = `
      import a from "./a";
      import {
        b,
      } from "./b";
      import type { C } from "./c";
      export * from "./d";
      import "./e";
      const f = await import("./f");
      const g = require("./g");
      // import h from "./h";
    `;
    assert.deepEqual(parseImports(src).sort(), ["./a", "./b", "./c", "./d", "./e", "./f", "./g"]);
  });
});

describe("createResolver", () => {
  const files = new Set([
    "apps/web/src/lib/a.ts",
    "apps/web/src/lib/b/index.tsx",
    "apps/web/src/app/page.tsx",
    "pkg/src/esm.ts",
  ]);
  const tsconfigs = new Map([
    [
      "apps/web/tsconfig.json",
      `{
        // 주석과 끝 쉼표를 허용한다
        "compilerOptions": { "paths": { "@/*": ["./src/*"], }, },
      }`,
    ],
  ]);
  const resolve = createResolver(files, tsconfigs);

  it("상대 경로를 푼다", () => {
    assert.equal(resolve("apps/web/src/app/page.tsx", "../lib/a"), "apps/web/src/lib/a.ts");
    assert.equal(resolve("apps/web/src/app/page.tsx", "../lib/b"), "apps/web/src/lib/b/index.tsx");
  });

  it("tsconfig paths 별칭을 푼다", () => {
    assert.equal(resolve("apps/web/src/app/page.tsx", "@/lib/a"), "apps/web/src/lib/a.ts");
  });

  it("별칭은 그 tsconfig 아래 파일에만 쓴다", () => {
    assert.equal(resolve("pkg/src/esm.ts", "@/lib/a"), null);
  });

  it(".js 로 쓴 import 를 .ts 파일로 푼다", () => {
    assert.equal(resolve("pkg/src/x.ts", "./esm.js"), "pkg/src/esm.ts");
  });

  it("패키지는 풀지 않는다", () => {
    assert.equal(resolve("apps/web/src/app/page.tsx", "react"), null);
  });
});

describe("analyzeRepo", () => {
  it("fanIn = 이 파일을 import 하는 다른 파일 수", () => {
    const sources = new Map([
      ["src/core.ts", `export function core(x) { return x ? 1 : 2; }`],
      ["src/a.ts", `import { core } from "./core";\nimport { core as c } from "./core.ts";`],
      ["src/b.ts", `import { core } from "./core";`],
      ["src/c.ts", `export const c = 1;`],
    ]);
    const result = analyzeRepo(sources, new Map());
    assert.equal(result["src/core.ts"].fanIn, 2);
    assert.equal(result["src/c.ts"].fanIn, 0);
  });
});
