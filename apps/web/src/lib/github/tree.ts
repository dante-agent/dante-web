// 연결된 레포의 소스 파일 트리 (서버 전용). `git/trees?recursive=1` 한 번으로 전체 blob 경로를 받아
// 소스만 남기고, 테스트 파일(`*.test.*` / `__tests__/`)은 대응 소스에 매칭해 status·testPath 로만 표현한다.
// 트리는 커밋 sha 로 캐시한다 — 같은 커밋이면 다시 받지 않는다(content-cache.ts).

import { cache } from "react";
import { githubApp } from "@/lib/github/app";
import { type ContentKey, cachedByContent } from "@/lib/github/content-cache";
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

/**
 * 캐시에 두는 blob 하나: [경로, 바이트, blob sha]. 캐시 한 항목은 2MB 제한이 있어 호출처가 실제로
 * 쓰는 것만 남긴다 — 소스·테스트(트리·크기·본문), tsconfig(imported-files 가 크기 맵에서 찾는다).
 */
type CompactBlob = [path: string, size: number, sha: string];
type CachedTree = { treeSha: string; totalBytes: number; blobs: CompactBlob[] };

const TSCONFIG_RE = /(^|\/)tsconfig(\.[\w-]+)?\.json$/;
const keepBlob = (path: string) => isSource(path) || isTest(path) || TSCONFIG_RE.test(path);

/** 커밋 하나의 전체 트리. 커밋 sha 가 키라 내용이 바뀌지 않는다 — 같은 커밋이면 GitHub 을 다시 치지 않는다. */
async function fetchTree(key: ContentKey): Promise<CachedTree> {
  const octokit = await githubApp().getInstallationOctokit(Number(key.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner: key.owner,
    repo: key.repo,
    tree_sha: key.sha,
    recursive: "1",
  });

  // ponytail: data.truncated 면 큰 레포라 일부 누락 — 서브트리 페치는 나중. 받은 만큼만 쓰는 건 전과 같다.
  let totalBytes = 0;
  const blobs: CompactBlob[] = [];
  for (const t of data.tree) {
    if (t.type !== "blob" || typeof t.path !== "string") continue;
    totalBytes += t.size ?? 0;
    if (t.size !== undefined && typeof t.sha === "string" && keepBlob(t.path)) {
      blobs.push([t.path, t.size, t.sha]);
    }
  }
  return { treeSha: data.sha, totalBytes, blobs };
}

/**
 * 기본 브랜치의 트리. 요청마다 브랜치 HEAD sha 만 가볍게 받고, 트리는 그 sha 로 캐시에서 꺼낸다.
 * push 가 있으면 sha 가 바뀌어 저절로 새로 받는다.
 */
async function buildTree(repo: ProjectRepo) {
  const installationId = repo.installationId.toString();
  const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
  const { data: branch } = await octokit.request("GET /repos/{owner}/{repo}/branches/{branch}", {
    owner: repo.repoOwner,
    repo: repo.repoName,
    branch: repo.defaultBranch,
  });
  const tree = await cachedByContent(
    "tree",
    { installationId, owner: repo.repoOwner, repo: repo.repoName, sha: branch.commit.sha },
    fetchTree
  );

  const blobs = tree.blobs.map(([path]) => path);
  const sources = blobs.filter(isSource);
  const tests = blobs.filter(isTest);
  const sourceSet = new Set(sources);

  const testBySource = new Map<string, string>();
  for (const t of tests) {
    const src = sourceCandidates(t).find((c) => sourceSet.has(c));
    if (src && !testBySource.has(src)) testBySource.set(src, t);
  }

  const entries: FileEntry[] = sources.sort().map((path) => {
    const testPath = testBySource.get(path);
    return testPath ? { path, status: "has", testPath } : { path, status: "none" };
  });

  // 추천 점수가 쓴다: 파일 크기(코드를 못 읽었을 때의 대리값), 레포 전체 크기(tarball 을 받을지),
  // 트리 sha(분석 결과 캐시 키 — 내용이 하나라도 바뀌면 달라진다).
  // blob sha 는 파일 본문 캐시 키다(blob.ts).
  const sizes = new Map<string, number>();
  const shas = new Map<string, string>();
  for (const [path, size, sha] of tree.blobs) {
    sizes.set(path, size);
    shas.set(path, sha);
  }

  return { entries, treeSha: tree.treeSha, sizes, shas, totalBytes: tree.totalBytes };
}

/**
 * 같은 요청 안에서는 한 번만 친다. React `cache` 는 서버 컴포넌트 렌더 안에서만 기억한다 — 라우트
 * 핸들러(채팅)에서는 부를 때마다 새로 돌아, 한 턴에 브랜치 조회가 여러 번 나갔다. 그래서 repo 객체를
 * 키로 한 WeakMap 에도 잡아 둔다. repo 는 요청마다 DB 에서 새로 읽은 객체라 요청을 넘어 남지 않는다.
 */
const inFlight = new WeakMap<ProjectRepo, ReturnType<typeof buildTree>>();
const loadTree = cache((repo: ProjectRepo) => {
  let pending = inFlight.get(repo);
  if (!pending) {
    pending = buildTree(repo);
    inFlight.set(repo, pending);
    // 실패는 기억하지 않는다 — 같은 요청에서 다시 부르면 다시 시도한다.
    pending.catch(() => inFlight.delete(repo));
  }
  return pending;
});

/** 연결된 레포의 소스 파일 트리 (테스트 유무를 status 로 얹은 것). */
export const getRepoTree = async (repo: ProjectRepo): Promise<FileEntry[]> =>
  (await loadTree(repo)).entries;

export type RepoTreeMeta = {
  treeSha: string;
  /** 경로 → 바이트. 소스·테스트·tsconfig blob 만(캐시 크기 때문). */
  sizes: ReadonlyMap<string, number>;
  /** 경로 → blob sha. sizes 와 같은 파일들. */
  shas: ReadonlyMap<string, string>;
  /** 모든 blob 크기의 합(압축 전). */
  totalBytes: number;
};

/** getRepoTree 와 같은 응답에서 뽑은 부가 정보. GitHub 을 다시 치지 않는다. */
export const getRepoTreeMeta = async (repo: ProjectRepo): Promise<RepoTreeMeta> => {
  const { treeSha, sizes, shas, totalBytes } = await loadTree(repo);
  return { treeSha, sizes, shas, totalBytes };
};
