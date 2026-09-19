// 추천 점수에 쓸 코드 신호(분기·줄 수·피참조 수)를 레포 전체에서 뽑는다 (서버 전용).
//
// 파일마다 contents API 를 부르면 큰 레포에서 레이트 리밋을 다 쓴다. 그래서 기본 브랜치
// tarball 을 한 번 받아 메모리에서 푼다. 결과는 트리 sha 로 캐시한다 — 푸시가 없으면
// 다시 받지 않고, 푸시가 있으면 sha 가 바뀌어 자연히 새로 계산한다.
//
// 실패하면 null 이다. 호출부(추천)는 경로·크기만으로 점수를 매긴다 — 신호가 빠질 뿐 목록은 나온다.
// 실패는 캐시하지 않는다(캐시된 함수가 던지면 저장되지 않는다).

import { gunzipSync } from "node:zlib";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { githubApp } from "@/lib/github/app";
import { extractTextFiles } from "@/lib/github/tar";
import { getRepoTreeMeta, isSource } from "@/lib/github/tree";
import { analyzeRepo, type RepoAnalysis } from "@/lib/projects/code-analysis";
import type { ProjectRepo } from "@/lib/projects/queries";

/** 이보다 큰 레포(모든 파일 합, 압축 전)는 받지 않는다. 함수 메모리·시간을 지킨다. */
const MAX_REPO_BYTES = 150 * 1024 * 1024;
/** tarball 다운로드 제한 시간. 넘기면 경로·크기만으로 매긴다. */
const DOWNLOAD_TIMEOUT_MS = 20_000;
/** 한 파일이 이보다 크면 분석하지 않는다(번들·생성 코드일 가능성이 높다). */
const MAX_FILE_BYTES = 300 * 1024;
/** 캐시 수명(초). 키에 트리 sha 가 있어 내용이 바뀌면 어차피 새 항목이다 — 오래 둬도 된다. */
const TTL_SECONDS = 7 * 24 * 60 * 60;

const TSCONFIG_RE = /(^|\/)tsconfig(\.[\w-]+)?\.json$/;

/**
 * 캐시 항목의 형태. 캐시 한 항목은 2MB 제한이 있어 파일마다 튜플로 줄인다:
 * [lines, branches, fanIn, flags(1 = hasLogic, 2 = barrel)]
 */
type CompactAnalysis = Record<string, [number, number, number, number]>;

// 캐시 키를 JSON 으로 만드는데 bigint 는 JSON 으로 바뀌지 않아 installationId 를 문자열로 넘긴다.
type CacheArgs = { owner: string; repo: string; branch: string; installationId: string };

async function downloadAndAnalyze(
  args: CacheArgs,
  sizes: Record<string, number>
): Promise<CompactAnalysis> {
  const octokit = await githubApp().getInstallationOctokit(Number(args.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/tarball/{ref}", {
    owner: args.owner,
    repo: args.repo,
    ref: args.branch,
    request: { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) },
  });
  const tar = gunzipSync(Buffer.from(data as ArrayBuffer), { maxOutputLength: MAX_REPO_BYTES });

  const wanted = (path: string) =>
    TSCONFIG_RE.test(path) || (isSource(path) && (sizes[path] ?? 0) <= MAX_FILE_BYTES);
  const files = extractTextFiles(tar, wanted);

  const sources = new Map<string, string>();
  const tsconfigs = new Map<string, string>();
  for (const [path, text] of files) (TSCONFIG_RE.test(path) ? tsconfigs : sources).set(path, text);

  return compact(analyzeRepo(sources, tsconfigs));
}

function compact(analysis: RepoAnalysis): CompactAnalysis {
  const out: CompactAnalysis = {};
  for (const [path, s] of Object.entries(analysis)) {
    out[path] = [s.lines, s.branches, s.fanIn, (s.hasLogic ? 1 : 0) | (s.barrel ? 2 : 0)];
  }
  return out;
}

function expand(compacted: CompactAnalysis): RepoAnalysis {
  const out: RepoAnalysis = {};
  for (const [path, [lines, branches, fanIn, flags]] of Object.entries(compacted)) {
    out[path] = { lines, branches, fanIn, hasLogic: (flags & 1) !== 0, barrel: (flags & 2) !== 0 };
  }
  return out;
}

/** 레포 전체의 코드 신호. 너무 크거나 실패하면 null. 같은 요청 안에서는 한 번만 계산한다. */
export const getCodeSignals = cache(async (repo: ProjectRepo): Promise<RepoAnalysis | null> => {
  try {
    const meta = await getRepoTreeMeta(repo);
    if (meta.totalBytes > MAX_REPO_BYTES) return null;

    const args: CacheArgs = {
      owner: repo.repoOwner,
      repo: repo.repoName,
      branch: repo.defaultBranch,
      installationId: repo.installationId.toString(),
    };
    // 크기 표는 캐시 키에 넣지 않는다(트리 sha 가 이미 내용을 대표한다). 그래서 인자가 아니라 클로저로 넘긴다.
    const sizes = Object.fromEntries(meta.sizes);
    const cached = unstable_cache(
      (a: CacheArgs) => downloadAndAnalyze(a, sizes),
      ["repo-code-signals", meta.treeSha],
      { revalidate: TTL_SECONDS }
    );
    return expand(await cached(args));
  } catch (error) {
    console.error("[code-signals] 코드 분석 실패, 경로 기준으로 폴백", error);
    return null;
  }
});
