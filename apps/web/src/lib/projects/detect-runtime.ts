import { cache } from "react";
import { githubApp } from "@/lib/github/app";
import { cachedRepoLookup, repoLookupKey, type RepoLookupKey } from "@/lib/github/lookup-cache";
import { errorStatus } from "@/lib/github/pull-request";
import type { ProjectRepo } from "@/lib/projects/queries";
import {
  FALLBACK_COMMANDS,
  frameworkTestCommand,
  type RuntimeCommands,
} from "@/lib/projects/runtime";

// 레포를 보고 기본 커맨드를 정한다 (서버 전용).
//
// 우리는 이미 이 레포를 읽을 수 있다. 그런데도 "npm install" 을 일괄로 들이밀면,
// bun 을 쓰는 사람은 화면에 뜬 기본값이 자기 레포에서 안 도는 명령이라는 걸
// 알아채고 직접 고쳐야 한다. 알 수 있는 걸 묻지 않는다.
//
// 실패하면(레포 접근 끊김, 파일 없음, 파싱 실패) 조용히 일반 기본값으로 떨어진다.
// 설정 화면이 GitHub 때문에 안 열리는 편보다, 기본값이 덜 정확한 편이 낫다.

interface PackageManager {
  id: "pnpm" | "yarn" | "bun" | "npm";
  /**
   * 이 매니저가 남기는 lockfile 이름들.
   *
   * bun 이 둘인 이유: 1.2 부터 텍스트 `bun.lock` 을 쓰고 그 전에는 바이너리
   * `bun.lockb` 였다. 새 이름만 보면 옛 레포를, 옛 이름만 보면 요즘 레포를 놓친다.
   */
  lockfiles: string[];
  install: string;
  /** package.json 의 scripts.test 를 부를 때 쓰는 접두사. */
  run: string;
}

/**
 * lockfile 이 여러 개일 때 위에서부터 먼저 걸리는 것을 쓴다. 확정적인 신호는
 * package.json 의 `packageManager` 필드이고(corepack 표준), 그게 있으면 순서를
 * 무시하고 그쪽을 따른다.
 *
 * install 커맨드에 `--frozen-lockfile` 류를 붙이는 이유: CI 와 같은 조건으로
 * 돌려야 "내 컴퓨터에선 됐는데" 가 안 생긴다. lockfile 이 package.json 과
 * 어긋나면 조용히 고치지 말고 실패하는 게 맞다.
 */
const PACKAGE_MANAGERS: PackageManager[] = [
  {
    id: "pnpm",
    lockfiles: ["pnpm-lock.yaml"],
    install: "pnpm install --frozen-lockfile",
    run: "pnpm",
  },
  {
    id: "yarn",
    lockfiles: ["yarn.lock"],
    // 샌드박스 이미지에 node·npm·pnpm·bun·corepack 은 있는데 yarn 만 없다
    // (2026-09 기준 vercel/sandbox/universal 에서 직접 확인). corepack 이
    // package.json 의 packageManager 를 보고 맞는 yarn 을 깔아준다.
    install: "corepack enable && yarn install --immutable",
    run: "corepack yarn",
  },
  {
    id: "bun",
    lockfiles: ["bun.lock", "bun.lockb"],
    install: "bun install --frozen-lockfile",
    run: "bun run",
  },
  { id: "npm", lockfiles: ["package-lock.json"], install: "npm ci", run: "npm run" },
];

/** lockfile 이 하나도 없을 때. `npm ci` 는 lockfile 이 없으면 실패한다. */
const NO_LOCKFILE: PackageManager = {
  id: "npm",
  lockfiles: [],
  install: "npm install",
  run: "npm run",
};

interface RootPackageJson {
  packageManager?: string;
  scripts?: { test?: string };
}

/**
 * 레포 루트만 본다. 모노레포 하위 패키지까지 뒤지지 않는 이유는, 어느 패키지를
 * 테스트할지는 우리가 정할 문제가 아니라서다 — 그건 사용자가 이 화면에서 적는다.
 *
 * GitHub 조회 결과는 몇 분 캐시된다(lib/github/lookup-cache.ts). 그래서
 * projectRef 를 받는다 — 캐시 키와 태그가 프로젝트 단위다.
 */
export const detectRuntimeCommands = cache(
  async (
    projectRef: string,
    repo: ProjectRepo,
    testFramework: string | null
  ): Promise<RuntimeCommands> => {
    try {
      const key = repoLookupKey(projectRef, repo);
      const [root, pkg] = await Promise.all([listRootFiles(key), readRootPackageJson(key)]);
      const manager = pickManager(root, pkg);

      return {
        install: manager.install,
        test: testCommand(manager, pkg, testFramework),
        source: "repo",
      };
    } catch (error) {
      // 조용히 떨어지되 흔적은 남긴다. 기본값이 왜 일반값으로 나오는지
      // 화면만 봐서는 알 수 없고, 그 상태로 두면 아무도 못 고친다.
      console.error(
        `[detect-runtime] ${repo.repoOwner}/${repo.repoName} 기본값 감지 실패:`,
        error instanceof Error ? error.message : error
      );
      return FALLBACK_COMMANDS;
    }
  }
);

function pickManager(root: Set<string>, pkg: RootPackageJson | null): PackageManager {
  // "pnpm@9.1.0" 처럼 이름@버전 형태다. 버전은 우리가 쓸 데가 없다.
  const declared = pkg?.packageManager?.split("@")[0]?.trim();
  const byField = PACKAGE_MANAGERS.find((candidate) => candidate.id === declared);
  if (byField) return byField;

  const byLockfile = PACKAGE_MANAGERS.find((candidate) =>
    candidate.lockfiles.some((lockfile) => root.has(lockfile))
  );
  return byLockfile ?? NO_LOCKFILE;
}

/**
 * `scripts.test` 가 있으면 그걸 부른다. 레포 주인이 이미 "이 프로젝트의 테스트는
 * 이렇게 돈다" 를 적어둔 것이라, 우리가 러너를 직접 호출하는 것보다 정확하다
 * (설정 파일 경로·환경 변수·선행 빌드가 그 스크립트에 숨어 있는 경우가 많다).
 *
 * 없으면 온보딩에서 고른 러너로 만든다.
 */
function testCommand(
  manager: PackageManager,
  pkg: RootPackageJson | null,
  testFramework: string | null
): string {
  const script = pkg?.scripts?.test;

  // `"test": "echo \"Error: no test specified\" && exit 1"` — npm init 이 넣어주는
  // 자리 표시자다. 이걸 그대로 쓰면 무조건 실패한다.
  if (typeof script === "string" && script.trim() !== "" && !/no test specified/.test(script)) {
    return `${manager.run} test`;
  }

  return frameworkTestCommand(testFramework);
}

/**
 * 루트 디렉터리 한 겹만. 트리 전체(recursive=1)를 받을 이유가 없다.
 *
 * 캐시에는 배열로 둔다 — 캐시 값은 JSON 으로 저장돼서 Set 이 그대로 안 남는다.
 * 실패하면 던진다(캐시되지 않는다). 위의 detectRuntimeCommands 가 받아서
 * 일반 기본값으로 떨어진다.
 */
async function listRootFiles(key: RepoLookupKey): Promise<Set<string>> {
  const files = await cachedRepoLookup("runtime-root-files", key, async (key) => {
    const octokit = await githubApp().getInstallationOctokit(Number(key.installationId));
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
      owner: key.owner,
      repo: key.repo,
      tree_sha: key.branch,
    });

    return data.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path ?? "");
  });

  return new Set(files);
}

async function readRootPackageJson(key: RepoLookupKey): Promise<RootPackageJson | null> {
  try {
    return await cachedRepoLookup("runtime-package-json", key, fetchRootPackageJson);
  } catch {
    // 접근이 끊겼거나 GitHub 이 잠깐 안 됐다. 러너 기본값으로 가되, 이 null 은
    // 캐시하지 않는다 — 다음에 열면 다시 물어본다.
    return null;
  }
}

/**
 * "없다"(404·파일 아님·JSON 깨짐)는 레포의 사실이라 null 로 돌려주고 캐시한다.
 * 그 밖의 실패는 던져서 캐시에 남지 않게 한다.
 */
async function fetchRootPackageJson(key: RepoLookupKey): Promise<RootPackageJson | null> {
  const octokit = await githubApp().getInstallationOctokit(Number(key.installationId));

  let data;
  try {
    ({ data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: key.owner,
      repo: key.repo,
      path: "package.json",
      ref: key.branch,
    }));
  } catch (error) {
    if (errorStatus(error) === 404) return null;
    throw error;
  }

  if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") return null;

  let pkg: RootPackageJson | null;
  try {
    pkg = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  } catch {
    return null;
  }

  // 쓰는 필드만 남긴다. package.json 을 통째로 캐시에 들고 있을 이유가 없다.
  return pkg && { packageManager: pkg.packageManager, scripts: { test: pkg.scripts?.test } };
}
