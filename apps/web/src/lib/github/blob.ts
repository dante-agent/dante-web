// 레포 파일 하나의 텍스트 (서버 전용). 파일 클릭 시 lazy 로 부른다.

import { githubApp } from "@/lib/github/app";
import type { ProjectRepo } from "@/lib/projects/queries";

/** 없거나 디렉터리·바이너리·1MB 초과(contents API 가 base64 안 줌)면 null. */
export async function getFileText(repo: ProjectRepo, path: string): Promise<string | null> {
  try {
    const octokit = await githubApp().getInstallationOctokit(Number(repo.installationId));
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: repo.repoOwner,
      repo: repo.repoName,
      path,
      ref: repo.defaultBranch,
    });
    if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    // ponytail: 큰 파일은 git/blobs 로 폴백 가능 — 지금은 null
    return null;
  }
}
