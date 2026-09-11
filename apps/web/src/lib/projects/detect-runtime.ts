import { cache } from "react";
import { githubApp } from "@/lib/github/app";
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
  scripts?: Record<string, string>;
}

/**
 * 레포 루트만 본다. 모노레포 하위 패키지까지 뒤지지 않는 이유는, 어느 패키지를
 * 테스트할지는 우리가 정할 문제가 아니라서다 — 그건 사용자가 이 화면에서 적는다.
 */
export const detectRuntimeCommands = cache(
  async (repo: ProjectRepo, testFramework: string | null): Promise<RuntimeCommands> => {
    try {
      const [root, pkg] = await Promise.all([listRootFiles(repo), readRootPackageJson(repo)]);
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

/** 루트 디렉터리 한 겹만. 트리 전체(recursive=1)를 받을 이유가 없다. */
async function listRootFiles(repo: ProjectRepo): Promise<Set<string>> {
  const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner: repo.repoOwner,
    repo: repo.repoName,
    tree_sha: repo.defaultBranch,
  });

  return new Set(
    data.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path ?? "")
  );
}

async function readRootPackageJson(repo: ProjectRepo): Promise<RootPackageJson | null> {
  try {
    const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: repo.repoOwner,
      repo: repo.repoName,
      path: "package.json",
      ref: repo.defaultBranch,
    });
    if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") return null;
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  } catch {
    // 없거나, 접근이 끊겼거나, JSON 이 깨졌거나. 어느 쪽이든 러너 기본값으로 간다.
    return null;
  }
}
