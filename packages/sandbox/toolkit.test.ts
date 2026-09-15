import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectPathAliases, parseJsonc, pathAliasRules, toolkitFiles } from "./toolkit.ts";

const reader = (files: Record<string, string>) => async (path: string) => files[path] ?? null;
// vitest resolve.alias: 맞은 부분만 치환한다(규칙이 ^…$ 로 전체를 잡으므로 결과는 같다).
const apply = (rules: { find: string; replacement: string }[], id: string) => {
  const rule = rules.find((r) => new RegExp(r.find).test(id));
  return rule ? id.replace(new RegExp(rule.find), rule.replacement) : null;
};
// jest moduleNameMapper: 맞으면 모듈 경로 전체가 replacement 가 된다($n 은 캡처로 채움).
const applyJest = (rules: { find: string; replacement: string }[], id: string) => {
  for (const rule of rules) {
    const match = new RegExp(rule.find).exec(id);
    if (match) return rule.replacement.replace(/\$(\d)/g, (_, n: string) => match[Number(n)] ?? "");
  }
  return null;
};

describe("parseJsonc", () => {
  it("reads tsconfig with block/line comments and trailing commas", () => {
    const text = `{
      "compilerOptions": {
        /* Bundler mode */
        "paths": { "@/*": ["./src/*"] }, // alias
        "jsx": "react-jsx",
      },
    }`;
    assert.deepEqual(parseJsonc(text), {
      compilerOptions: { paths: { "@/*": ["./src/*"] }, jsx: "react-jsx" },
    });
  });

  it("keeps comment-like text inside strings", () => {
    assert.deepEqual(parseJsonc('{ "a": "http://x/*y*/", "b": "c\\"//d" }'), {
      a: "http://x/*y*/",
      b: 'c"//d',
    });
  });

  it("returns null for broken input", () => {
    assert.equal(parseJsonc("{ nope"), null);
  });
});

describe("collectPathAliases", () => {
  it("reads paths from the root tsconfig (8around-sns shape)", async () => {
    const aliases = await collectPathAliases(
      reader({ "tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }' })
    );
    assert.deepEqual(aliases, [{ key: "@/*", target: "*" }]);
  });

  it("follows references when the root has none (Vite template, hashsnap-test shape)", async () => {
    const aliases = await collectPathAliases(
      reader({
        "tsconfig.json":
          '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }',
        "tsconfig.app.json": '{ "compilerOptions": { /* c */ "paths": { "@/*": ["./src/*"] } } }',
        "tsconfig.node.json": '{ "compilerOptions": {} }',
      })
    );
    assert.deepEqual(aliases, [{ key: "@/*", target: "src/*" }]);
  });

  it("uses baseUrl, keeps exact keys, drops node_modules targets (blog shape)", async () => {
    const aliases = await collectPathAliases(
      reader({
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/components/*": ["components/*"],
              "contentlayer/generated": ["./.contentlayer/generated"],
              "pliny/*": ["node_modules/pliny/*"],
            },
          },
        }),
      })
    );
    assert.deepEqual(aliases, [
      { key: "@/components/*", target: "components/*" },
      { key: "contentlayer/generated", target: ".contentlayer/generated" },
    ]);
  });

  it("follows relative extends and lets the child override", async () => {
    const aliases = await collectPathAliases(
      reader({
        "tsconfig.json":
          '{ "extends": "./config/base", "compilerOptions": { "paths": { "@/*": ["./app/*"] } } }',
        "config/base.json":
          '{ "compilerOptions": { "baseUrl": "..", "paths": { "@/*": ["src/*"], "~/*": ["lib/*"] } } }',
      })
    );
    assert.deepEqual(aliases, [
      { key: "@/*", target: "app/*" },
      { key: "~/*", target: "lib/*" },
    ]);
  });

  it("returns nothing when tsconfig is missing and does not loop on cycles", async () => {
    assert.deepEqual(await collectPathAliases(reader({})), []);
    const cyclic = await collectPathAliases(
      reader({ "tsconfig.json": '{ "references": [{ "path": "." }] }' })
    );
    assert.deepEqual(cyclic, []);
  });
});

describe("pathAliasRules", () => {
  const rules = pathAliasRules(
    [
      { key: "@/*", target: "src/*" },
      { key: "@/components/*", target: "ui/*" },
      { key: "contentlayer/generated", target: ".contentlayer/generated" },
    ],
    "/vercel/repo"
  );

  it("maps imports to repo paths, more specific keys first", () => {
    assert.equal(apply(rules, "@/components/Button"), "/vercel/repo/ui/Button");
    assert.equal(apply(rules, "@/features/x/y"), "/vercel/repo/src/features/x/y");
    assert.equal(apply(rules, "contentlayer/generated"), "/vercel/repo/.contentlayer/generated");
    assert.equal(apply(rules, "contentlayer/generated/extra"), null);
  });
});

describe("toolkitFiles", () => {
  const base = {
    repoDir: "/vercel/repo",
    aliases: [{ key: "@/*", target: "src/*" }],
    testFiles: ["src/a.test.tsx"],
    reportPath: "/tmp/r.json",
  };

  it("jest: CSS stub comes before path aliases, React maps to the repo", () => {
    const { files, command } = toolkitFiles({ ...base, framework: "jest" });
    const config = files.find((f) => f.path.endsWith("jest.config.cjs"))!.content;
    const mapper = JSON.parse(
      config.replace(/^module\.exports = /, "").replace(/;\s*$/, "")
    ).moduleNameMapper;
    const keys = Object.keys(mapper);
    assert.equal(keys[0], "\\.(css|less|scss|sass)$");
    const rules = keys.map((find) => ({ find, replacement: mapper[find] }));
    assert.equal(applyJest(rules, "@/index.css"), "/tmp/dante-toolkit/style-stub.cjs");
    assert.equal(applyJest(rules, "@/features/a"), "/vercel/repo/src/features/a");
    assert.equal(
      applyJest(rules, "react-dom/client"),
      "/vercel/repo/node_modules/react-dom/client"
    );
    assert.equal(applyJest(rules, "react-hook-form"), null);
    assert.equal(
      applyJest(rules, "@testing-library/user-event"),
      "/tmp/dante-toolkit/node_modules/@testing-library/user-event"
    );
    assert.match(command, /--runTestsByPath 'src\/a\.test\.tsx'$/);
  });

  it("vitest: sets NODE_PATH to the repo and writes a setup that cleans up", () => {
    const { files, command } = toolkitFiles({ ...base, framework: "vitest" });
    assert.match(command, /^export NODE_PATH='\/vercel\/repo\/node_modules'; /);
    assert.match(command, /--outputFile\.json=\/tmp\/r\.json 'src\/a\.test\.tsx'$/);
    const setup = files.find((f) => f.path.endsWith("setup.mjs"))!.content;
    assert.match(setup, /afterEach\(\(\) => cleanup\(\)\)/);
    assert.match(setup, /jest-dom\/vitest/);
  });
});
