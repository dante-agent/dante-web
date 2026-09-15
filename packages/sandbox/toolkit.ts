import { posix } from "node:path";
import type { TestFramework } from "./report.ts";

// Dante 전용 테스트 실행 환경 (docs/adr/0003-dante-provided-test-toolkit.md). 순수 함수만 둔다.
//
// 러너·설정·테스트 도구는 레포 밖 폴더(TOOLKIT_DIR)에 두고, 레포에서는 소스와 소스가 쓰는 패키지만 빌린다.
// 사용자 레포에 테스트 라이브러리가 없어도 돌리려는 것이다. 폴더 보기 실시간 실행만 쓴다 — PR 경로(runTest)는 레포 그대로.

export const TOOLKIT_DIR = "/tmp/dante-toolkit";
const TOOL = `${TOOLKIT_DIR}/node_modules`;

const TESTING_LIBRARY = [
  "@testing-library/react@16.3.3",
  "@testing-library/dom@10.4.2",
  "@testing-library/user-event@14.6.7",
  "@testing-library/jest-dom@7.0.1",
];

/**
 * 러너별 도구 세트. 샌드박스 실험(ADR-0003 "검증")에서 통과한 버전으로 고정한다 — 실행마다 최신을 받지 않는다.
 * testing-library 16 은 React 18·19 대상이다.
 */
export const TOOLKIT_PACKAGES: Record<TestFramework, string[]> = {
  vitest: ["vitest@4.1.11", "jsdom@30.0.1", ...TESTING_LIBRARY],
  jest: [
    "jest@30.5.1",
    "jest-environment-jsdom@30.5.1",
    "@swc/core@1.16.2",
    "@swc/jest@0.2.39",
    ...TESTING_LIBRARY,
  ],
};

/**
 * tsconfig 는 JSON 이 아니라 JSONC 다(주석·끝 쉼표). 문자열 밖의 주석과 끝 쉼표를 걷고 파싱한다.
 * 못 읽으면 null.
 */
export function parseJsonc(text: string): unknown {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += text[++i] ?? "";
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else {
      out += ch;
    }
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

/** tsconfig `paths` 항목 하나를 레포 루트 기준으로 푼 것. 예: `{ key: "@/*", target: "src/*" }` */
export type PathAlias = { key: string; target: string };

type TsconfigShape = {
  extends?: unknown;
  references?: { path?: unknown }[];
  compilerOptions?: { baseUrl?: unknown; paths?: Record<string, unknown> };
};

/**
 * 레포 tsconfig 에서 경로 별칭을 모은다. `extends`(상대 경로만)와 `references` 를 따라간다 —
 * Vite 템플릿은 루트 tsconfig.json 이 references 만 두고 paths 는 tsconfig.app.json 에 있다.
 *
 * - 후보가 여럿이면 첫 번째만 쓴다.
 * - node_modules 나 레포 밖을 가리키는 별칭은 버린다(패키지 exports 를 우회하게 된다).
 * - 같은 키가 여러 파일에 있으면 나중에 읽은 것(자식·참조)이 이긴다.
 *
 * read 는 레포 루트 기준 경로를 받아 파일 내용을 돌려준다(없으면 null).
 */
export async function collectPathAliases(
  read: (path: string) => Promise<string | null>,
  entry = "tsconfig.json"
): Promise<PathAlias[]> {
  const result = new Map<string, string>();
  const visited = new Set<string>();

  async function load(file: string) {
    const normalized = posix.normalize(file);
    if (visited.has(normalized) || normalized.startsWith("..")) return;
    visited.add(normalized);

    const text = await read(normalized);
    const json = text === null ? null : (parseJsonc(text) as TsconfigShape | null);
    if (!json || typeof json !== "object") return;
    const dir = posix.dirname(normalized);

    if (typeof json.extends === "string" && json.extends.startsWith(".")) {
      const ext = json.extends.endsWith(".json") ? json.extends : `${json.extends}.json`;
      await load(posix.join(dir, ext));
    }

    const options = json.compilerOptions;
    if (options?.paths && typeof options.paths === "object") {
      const base = posix.join(dir, typeof options.baseUrl === "string" ? options.baseUrl : ".");
      for (const [key, targets] of Object.entries(options.paths)) {
        const first = Array.isArray(targets) ? targets[0] : undefined;
        if (typeof first !== "string") continue;
        const target = posix.normalize(posix.join(base, first));
        if (target.startsWith("..") || /(^|\/)node_modules(\/|$)/.test(target)) continue;
        result.set(key, target);
      }
    }

    for (const ref of Array.isArray(json.references) ? json.references : []) {
      if (typeof ref?.path !== "string") continue;
      const path = posix.join(dir, ref.path);
      await load(path.endsWith(".json") ? path : posix.join(path, "tsconfig.json"));
    }
  }

  await load(entry);
  return [...result].map(([key, target]) => ({ key, target }));
}

/** 정규식 규칙 하나. vitest `resolve.alias` 와 jest `moduleNameMapper` 가 같은 모양(`$1` 치환)을 쓴다. */
export type AliasRule = { find: string; replacement: string };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * tsconfig 별칭 → 정규식 규칙. 긴 키부터 — `@/components/*` 가 `@/*` 보다 먼저 걸려야 한다.
 * `*` 는 키와 대상에 하나씩만 있다고 본다(tsconfig 규칙과 같다).
 */
export function pathAliasRules(aliases: PathAlias[], repoDir: string): AliasRule[] {
  return [...aliases]
    .sort((a, b) => b.key.length - a.key.length)
    .map(({ key, target }) => {
      const star = key.indexOf("*");
      if (star === -1) {
        return { find: `^${escapeRegExp(key)}$`, replacement: `${repoDir}/${target}` };
      }
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      return {
        find: `^${escapeRegExp(prefix)}(.*)${escapeRegExp(suffix)}$`,
        replacement: `${repoDir}/${target.replace("*", "$1")}`,
      };
    });
}

/** 도구는 Dante 폴더에서, React 는 레포 것 한 벌만(두 벌이면 hooks 가 깨진다). */
function sharedRules(repoDir: string): AliasRule[] {
  return [
    {
      find: "^@testing-library\\/(react|dom|user-event|jest-dom)(\\/.*)?$",
      replacement: `${TOOL}/@testing-library/$1$2`,
    },
    { find: "^react(\\/.*)?$", replacement: `${repoDir}/node_modules/react$1` },
    { find: "^react-dom(\\/.*)?$", replacement: `${repoDir}/node_modules/react-dom$1` },
  ];
}

export type ToolkitFiles = {
  files: { path: string; content: string }[];
  /** 샌드박스에서 돌릴 테스트 커맨드(레포 디렉터리에서). 리포트는 reportPath 에 JSON 으로 쓴다. */
  command: string;
};

/**
 * 러너별 설정·setup 파일과 실행 커맨드를 만든다.
 *
 * vitest: `server.deps.inline` 으로 도구를 변환 경로에 태워 별칭이 먹게 하고, testing-library 의 CJS
 * `require("react")` 는 NODE_PATH 로 레포 React 를 찾게 한다(없으면 Cannot find module 'react').
 * jest: moduleNameMapper 가 node_modules 안까지 적용돼 NODE_PATH 가 필요 없다. CSS 규칙은 경로 별칭보다
 * 먼저 둔다 — 위에서부터 처음 맞는 규칙을 써서, 뒤에 두면 `@/index.css` 를 JS 로 읽는다.
 */
export function toolkitFiles(args: {
  framework: TestFramework;
  repoDir: string;
  aliases: PathAlias[];
  testFiles: string[];
  reportPath: string;
}): ToolkitFiles {
  const { framework, repoDir, testFiles, reportPath } = args;
  const rules = [...pathAliasRules(args.aliases, repoDir), ...sharedRules(repoDir)];
  const quoted = testFiles.map(shellQuote).join(" ");

  if (framework === "vitest") {
    const data = { root: repoDir, include: testFiles, rules, setup: `${TOOLKIT_DIR}/setup.mjs` };
    return {
      files: [
        {
          path: `${TOOLKIT_DIR}/vitest.config.mjs`,
          content: [
            `import { defineConfig } from ${JSON.stringify(`${TOOL}/vitest/dist/config.js`)};`,
            `const data = ${JSON.stringify(data)};`,
            "export default defineConfig({",
            "  root: data.root,",
            "  resolve: { alias: data.rules.map((r) => ({ find: new RegExp(r.find), replacement: r.replacement })) },",
            "  test: {",
            '    environment: "jsdom",',
            "    include: data.include,",
            "    setupFiles: [data.setup],",
            "    server: { deps: { inline: [/@testing-library/] } },",
            "  },",
            "});",
            "",
          ].join("\n"),
        },
        {
          path: `${TOOLKIT_DIR}/setup.mjs`,
          content: [
            'import { afterEach } from "vitest";',
            'import { cleanup } from "@testing-library/react";',
            'import "@testing-library/jest-dom/vitest";',
            "afterEach(() => cleanup());",
            "",
          ].join("\n"),
        },
      ],
      command:
        `export NODE_PATH=${shellQuote(`${repoDir}/node_modules`)}; ` +
        `${TOOL}/.bin/vitest run --config ${TOOLKIT_DIR}/vitest.config.mjs ` +
        `--reporter=default --reporter=json --outputFile.json=${reportPath} ${quoted}`,
    };
  }

  const moduleNameMapper: Record<string, string> = {
    "\\.(css|less|scss|sass)$": `${TOOLKIT_DIR}/style-stub.cjs`,
  };
  for (const rule of rules) moduleNameMapper[rule.find] = rule.replacement;
  moduleNameMapper["^@jest\\/globals$"] = `${TOOL}/@jest/globals`;

  const config = {
    rootDir: repoDir,
    testEnvironment: `${TOOL}/jest-environment-jsdom`,
    transform: {
      "^.+\\.(t|j)sx?$": [
        `${TOOL}/@swc/jest`,
        {
          jsc: {
            parser: { syntax: "typescript", tsx: true },
            transform: { react: { runtime: "automatic" } },
          },
          module: { type: "commonjs" },
        },
      ],
    },
    moduleNameMapper,
    setupFilesAfterEnv: [`${TOOLKIT_DIR}/jest.setup.cjs`],
    testPathIgnorePatterns: ["/node_modules/"],
  };
  return {
    files: [
      {
        path: `${TOOLKIT_DIR}/jest.config.cjs`,
        content: `module.exports = ${JSON.stringify(config, null, 2)};\n`,
      },
      { path: `${TOOLKIT_DIR}/jest.setup.cjs`, content: 'require("@testing-library/jest-dom");\n' },
      { path: `${TOOLKIT_DIR}/style-stub.cjs`, content: "module.exports = {};\n" },
    ],
    command:
      `${TOOL}/.bin/jest --config ${TOOLKIT_DIR}/jest.config.cjs --ci ` +
      `--json --outputFile=${reportPath} --runTestsByPath ${quoted}`,
  };
}

/**
 * 도구 설치 커맨드. 레포 밖 폴더에 npm 으로 설치한다(레포의 패키지 매니저와 무관).
 * vitest 는 npm 이 peer 로 딸려 설치한 React 를 지운다 — 남으면 React 가 두 벌이 된다.
 */
export function toolkitInstallCommand(framework: TestFramework): string {
  const steps = [
    `mkdir -p ${TOOLKIT_DIR}`,
    `cd ${TOOLKIT_DIR}`,
    "npm init -y >/dev/null",
    `npm install --no-audit --no-fund ${TOOLKIT_PACKAGES[framework].join(" ")}`,
  ];
  if (framework === "vitest")
    steps.push("rm -rf node_modules/react node_modules/react-dom node_modules/scheduler");
  return steps.join(" && ");
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
