import { githubApp } from "@/lib/github/app";

// ⚠️ 서버 전용 (app.ts 참고).

/** 화면이 필요로 하는 필드만 추린 모양. Octokit 응답을 그대로 흘려보내지 않는다. */
export type InstallationRepo = {
  id: number;
  owner: string;
  name: string;
  private: boolean;
  language: string | null;
  defaultBranch: string;
  /** ISO 문자열. 레포를 최근 푸시 순으로 보여주는 데 쓴다. */
  pushedAt: string | null;
};

// per_page 최대치가 100 이라 한 번에 다 못 받는 계정이 있다.
// 레포 500개까지만 본다 — 그 이상은 검색을 서버로 넘기는 별도 작업이 필요하다.
const MAX_PAGES = 5;
const PER_PAGE = 100;

/**
 * 이 설치가 열어준 레포 목록.
 *
 * "사용자의 모든 레포"가 아니라 "사용자가 이 설치에서 고른 레포"만 나온다.
 * 그래서 목록이 비어 보이면 권한 문제가 아니라 설치할 때 레포를 안 고른 것이다
 * — 화면에서 설치 설정으로 돌아가는 링크를 꼭 같이 보여줘야 하는 이유다.
 */
export async function listInstallationRepos(installationId: number): Promise<InstallationRepo[]> {
  const octokit = await githubApp().getInstallationOctokit(installationId);

  const collected: InstallationRepo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.request("GET /installation/repositories", {
      per_page: PER_PAGE,
      page,
    });

    for (const repo of data.repositories) {
      collected.push({
        id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        private: repo.private,
        language: repo.language ?? null,
        defaultBranch: repo.default_branch,
        pushedAt: repo.pushed_at ?? null,
      });
    }

    if (data.repositories.length < PER_PAGE) break;
  }

  // 최근 푸시 순. 방금 작업하던 레포가 위에 오는 편이 고르기 쉽다.
  return collected.sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
}
