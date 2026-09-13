// 연결된 레포의 소스 파일 트리 (서버 전용). `git/trees?recursive=1` 한 번으로 전체 blob 경로를 받아
// 소스만 남기고, 테스트 파일(`*.test.*` / `__tests__/`)은 대응 소스에 매칭해 status·testPath 로만 표현한다.

import { cache } from "react";
import { githubApp } from "@/lib/github/app";
import type { FileEntry } from "@/lib/file-tree";
import type { ProjectRepo } from "@/lib/projects/queries";

const SRC_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;
const TEST_RE = /(\.(test|spec)\.[jt]sx?$|(^|\/)__tests__\/)/;
const IGNORE = /(^|\/)(node_modules|dist|build|out|\.next|coverage|\.turbo|vendor)\//;

function isSource(path: string) {
  return SRC_EXT.test(path) && !path.endsWith(".d.ts") && !IGNORE.test(path) && !TEST_RE.test(path);
}
function isTest(path: string) {
  return SRC_EXT.test(path) && !IGNORE.test(path) && TEST_RE.test(path);
}

/** 테스트 경로 → 대응 소스 경로 후보. `a/b/__tests__/foo.ts` · `a/b/foo.test.ts` → `a/b/foo.{ext}` */
function sourceCandidates(testPath: string): string[] {
  const base = testPath
    .replace(/(^|\/)__tests__\//, "$1")
    .replace(/\.(test|spec)\.[jt]sx?$/, "")
    .replace(/\.[jt]sx?$/, "");
  return ["ts", "tsx", "js", "jsx", "mjs", "cjs"].map((e) => `${base}.${e}`);
}

/** 대시보드 지표용 집계. 트리와 같은 응답에서 함께 뽑는다. */
export type RepoStats = {
  /** 소스 파일 수(테스트 제외). SuitePanel 의 "Components". */
  components: number;
  /** 테스트 파일 수(대응 소스를 못 찾은 것 포함). SuitePanel 의 "Tests". */
  testFiles: number;
  /** 대응 테스트가 있는 소스 수. tested ≤ components — 커버리지 비율 계산용. */
  tested: number;
};

/**
 * blob 목록을 한 번 받아 트리 엔트리와 집계를 같이 만든다. cache 로 요청 1회 —
 * getRepoTree·getRepoStats 가 같은 페이지에서 불려도 GitHub 는 한 번만 친다.
 */
const loadTree = cache(async (repo: ProjectRepo) => {
  const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner: repo.repoOwner,
    repo: repo.repoName,
    tree_sha: repo.defaultBranch,
    recursive: "1",
  });

  const blobs = data.tree
    .filter((t) => t.type === "blob" && typeof t.path === "string")
    .map((t) => t.path as string);

  const sources = blobs.filter(isSource);
  const tests = blobs.filter(isTest);
  const sourceSet = new Set(sources);

  const testBySource = new Map<string, string>();
  for (const t of tests) {
    const src = sourceCandidates(t).find((c) => sourceSet.has(c));
    if (src && !testBySource.has(src)) testBySource.set(src, t);
  }

  // ponytail: data.truncated 면 큰 레포라 일부 누락 — 서브트리 페치는 나중
  const entries: FileEntry[] = sources.sort().map((path) => {
    const testPath = testBySource.get(path);
    return testPath ? { path, status: "has", testPath } : { path, status: "none" };
  });

  const stats: RepoStats = {
    components: sources.length,
    testFiles: tests.length,
    tested: testBySource.size,
  };

  return { entries, stats };
});

/** 연결된 레포의 소스 파일 트리 (테스트 유무를 status 로 얹은 것). */
export const getRepoTree = async (repo: ProjectRepo): Promise<FileEntry[]> =>
  (await loadTree(repo)).entries;

/** 같은 트리에서 뽑은 소스·테스트 파일 집계. 대시보드 SuitePanel 용. */
export const getRepoStats = async (repo: ProjectRepo): Promise<RepoStats> =>
  (await loadTree(repo)).stats;
