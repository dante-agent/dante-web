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

export const getRepoTree = cache(async (repo: ProjectRepo): Promise<FileEntry[]> => {
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
  const sourceSet = new Set(sources);

  const testBySource = new Map<string, string>();
  for (const t of blobs.filter(isTest)) {
    const src = sourceCandidates(t).find((c) => sourceSet.has(c));
    if (src && !testBySource.has(src)) testBySource.set(src, t);
  }

  // ponytail: data.truncated 면 큰 레포라 일부 누락 — 서브트리 페치는 나중
  return sources.sort().map((path) => {
    const testPath = testBySource.get(path);
    return testPath ? { path, status: "has", testPath } : { path, status: "none" };
  });
});
