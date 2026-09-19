// 레포 파일 하나의 텍스트 (서버 전용). 파일 클릭 시 lazy 로 부른다.
//
// 트리에 blob sha 가 있는 파일(소스·테스트·tsconfig)은 blob sha 로 본문을 캐시한다. sha 가 같으면
// 내용도 같으니 채팅 턴마다·파일을 다시 열 때마다 GitHub 을 치지 않는다. 트리에 없는 파일은 전처럼
// contents API 로 매번 받는다.

import { githubApp } from "@/lib/github/app";
import { type ContentKey, cachedByContent } from "@/lib/github/content-cache";
import { getRepoTreeMeta } from "@/lib/github/tree";
import type { ProjectRepo } from "@/lib/projects/queries";

/** contents API 가 base64 본문을 주는 상한. 이보다 크면 전처럼 null 이다. */
const MAX_FILE_BYTES = 1024 * 1024;

async function fetchBlobText(key: ContentKey): Promise<string> {
  const octokit = await githubApp().getInstallationOctokit(Number(key.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/git/blobs/{file_sha}", {
    owner: key.owner,
    repo: key.repo,
    file_sha: key.sha,
  });
  return Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8").toString("utf8");
}

async function fetchContentsText(repo: ProjectRepo, path: string): Promise<string | null> {
  const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner: repo.repoOwner,
    repo: repo.repoName,
    path,
    ref: repo.defaultBranch,
  });
  if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}

/** 없거나 디렉터리·바이너리·1MB 초과(contents API 가 base64 안 줌)면 null. */
export async function getFileText(repo: ProjectRepo, path: string): Promise<string | null> {
  try {
    // 트리를 못 받아도(빈 레포 등) 파일 하나는 contents API 로 시도한다 — 전과 같은 동작.
    const meta = await getRepoTreeMeta(repo).catch(() => null);
    const sha = meta?.shas.get(path);
    if (!meta || !sha) return await fetchContentsText(repo, path);
    if ((meta.sizes.get(path) ?? 0) > MAX_FILE_BYTES) return null;
    return await cachedByContent(
      "blob",
      {
        installationId: repo.installationId.toString(),
        owner: repo.repoOwner,
        repo: repo.repoName,
        sha,
      },
      fetchBlobText
    );
  } catch {
    // ponytail: 큰 파일은 git/blobs 로 폴백 가능 — 지금은 null
    return null;
  }
}
