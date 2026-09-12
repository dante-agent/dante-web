import { unstable_cache, updateTag } from "next/cache";
import type { ProjectRepo } from "@/lib/projects/queries";

// ⚠️ 서버 전용.
//
// 설정 화면(runtime·notifications)이 열릴 때마다 GitHub 을 부르던 조회에 거는
// 짧은 서버 캐시. 레포의 lockfile 이나 룰셋은 몇 분 사이에 거의 안 바뀌는데,
// 화면을 열 때마다 왕복하면 느리고 레이트 리밋만 깎인다.
//
// `"use cache"` 가 아니라 `unstable_cache` 인 이유: 그쪽은 next.config 의
// `cacheComponents` 를 켜야 하고, 그러면 앱 전체의 렌더링 규칙이 바뀐다.
// 조회 두 개 때문에 그걸 켤 일은 아니다.
//
// 캐시에 넣는 것은 조회 결과(문자열·작은 객체)뿐이다. 설치 토큰은 캐시된 함수
// 안에서 그때그때 받는다 — 결과에 담기지 않고, 그 안의 fetch 는 Next 가
// no-store 로 다룬다.
//
// 실패는 캐시하지 않는다. 캐시된 함수가 던지면 저장되지 않으므로, 일시적인
// 실패(토큰 발급 실패·5xx·레이트 리밋)는 던지고 호출부가 기본값으로 접는다.
// 실패를 "결과"로 돌려주면 몇 분 동안 그 실패가 화면에 붙어 있게 된다.

/** 캐시 수명(초). 이보다 오래된 값은 다음 요청이 뒤에서 새로 받는다. */
const TTL_SECONDS = 300;

/**
 * 결과를 정하는 전부. 이 중 하나라도 다르면 다른 캐시 항목이다 — 레포 이름이
 * 바뀌거나 기본 브랜치가 바뀌면 따로 지우지 않아도 새로 조회한다.
 *
 * installationId 가 문자열인 이유: 캐시 키를 JSON 으로 만드는데 bigint 는
 * JSON 으로 바뀌지 않는다.
 */
export type RepoLookupKey = {
  projectRef: string;
  installationId: string;
  owner: string;
  repo: string;
  branch: string;
};

export function repoLookupKey(projectRef: string, repo: ProjectRepo): RepoLookupKey {
  return {
    projectRef,
    installationId: String(repo.installationId),
    owner: repo.repoOwner,
    repo: repo.repoName,
    branch: repo.defaultBranch,
  };
}

/** 프로젝트 하나의 GitHub 조회 캐시 전부에 붙는 태그. */
const projectTag = (projectRef: string) => `project:${projectRef}:github`;

/**
 * `fetch` 결과를 프로젝트 태그로 캐시한다.
 *
 * `name` 은 조회 종류다. 키는 name + key(JSON) 로 정해진다 — 키 조각을
 * 쉼표로 이어 붙이는 방식에 맡기면 브랜치 이름의 쉼표에서 서로 겹칠 수 있어서,
 * 값들은 인자로 넘긴다.
 *
 * `fetch` 는 key 만 보고 결과를 만들어야 한다. 바깥 변수를 끌어다 쓰면 그 값은
 * 키에 없으므로 다른 프로젝트의 결과가 섞일 수 있다.
 */
export function cachedRepoLookup<T>(
  name: string,
  key: RepoLookupKey,
  fetch: (key: RepoLookupKey) => Promise<T>
): Promise<T> {
  return unstable_cache(fetch, ["github-lookup", name], {
    tags: [projectTag(key.projectRef)],
    revalidate: TTL_SECONDS,
  })(key);
}

/**
 * 이 프로젝트의 GitHub 조회 캐시를 비운다. 서버 액션에서만 부를 수 있다.
 *
 * `revalidateTag(tag, "max")` 가 아니라 `updateTag` 인 이유: 저장 직후 다시 그린
 * 화면이 옛 값을 보여주면 안 된다. updateTag 는 다음 요청이 새로 받을 때까지
 * 기다린다.
 */
export function invalidateRepoLookups(projectRef: string) {
  updateTag(projectTag(projectRef));
}
