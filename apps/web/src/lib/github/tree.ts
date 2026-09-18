// 연결된 레포의 소스 파일 트리 (서버 전용). `git/trees?recursive=1` 한 번으로 전체 blob 경로를 받아
// 소스만 남기고, 테스트 파일(`*.test.*` / `__tests__/`)은 대응 소스에 매칭해 status·testPath 로만 표현한다.

import { cache } from "react";
import { githubApp } from "@/lib/github/app";
import type { FileEntry } from "@/lib/file-tree";
import type { ProjectRepo } from "@/lib/projects/queries";

const SRC_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;
const TEST_RE = /(\.(test|spec)\.[jt]sx?$|(^|\/)__tests__\/)/;
const IGNORE = /(^|\/)(node_modules|dist|build|out|\.next|coverage|\.turbo|vendor)\//;

export function isSource(path: string) {
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

/** blob 목록을 한 번 받아 트리 엔트리를 만든다. cache 로 같은 요청 안에서는 GitHub 를 한 번만 친다. */
const loadTree = cache(async (repo: ProjectRepo) => {
  const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner: repo.repoOwner,
    repo: repo.repoName,
    tree_sha: repo.defaultBranch,
    recursive: "1",
  });

  const blobItems = data.tree.filter((t) => t.type === "blob" && typeof t.path === "string");
  const blobs = blobItems.map((t) => t.path as string);

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

  // 추천 점수가 쓴다: 파일 크기(코드를 못 읽었을 때의 대리값), 레포 전체 크기(tarball 을 받을지),
  // 트리 sha(분석 결과 캐시 키 — 내용이 하나라도 바뀌면 달라진다).
  const sizes = new Map<string, number>();
  let totalBytes = 0;
  for (const t of blobItems) {
    totalBytes += t.size ?? 0;
    if (t.size !== undefined) sizes.set(t.path as string, t.size);
  }

  return { entries, treeSha: data.sha, sizes, totalBytes };
});

/** 연결된 레포의 소스 파일 트리 (테스트 유무를 status 로 얹은 것). */
export const getRepoTree = async (repo: ProjectRepo): Promise<FileEntry[]> =>
  (await loadTree(repo)).entries;

export type RepoTreeMeta = {
  treeSha: string;
  /** 경로 → 바이트. blob 만. */
  sizes: ReadonlyMap<string, number>;
  /** 모든 blob 크기의 합(압축 전). */
  totalBytes: number;
};

/** getRepoTree 와 같은 응답에서 뽑은 부가 정보. GitHub 을 다시 치지 않는다. */
export const getRepoTreeMeta = async (repo: ProjectRepo): Promise<RepoTreeMeta> => {
  const { treeSha, sizes, totalBytes } = await loadTree(repo);
  return { treeSha, sizes, totalBytes };
};
