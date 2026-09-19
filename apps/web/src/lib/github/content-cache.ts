import { unstable_cache } from "next/cache";

// ⚠️ 서버 전용.
//
// 내용이 바뀌지 않는 키(커밋 sha·blob sha)로 GitHub 응답을 캐시한다. 레포 트리와 파일 본문이 쓴다.
// 키가 가리키는 내용은 영영 같으므로 push 뒤 옛 값을 보여 줄 일이 없다 — 웹훅 무효화가 필요 없다.
// lookup-cache.ts(TTL 5분)와 다른 점이 이것이다: 그쪽은 브랜치 이름이 키라 push 직후 옛 값이 보일 수 있다.
//
// 권한 경계: 키에 설치 id 를 넣는다. 같은 레포라도 다른 설치(다른 팀)의 항목은 따로 받는다.
// 캐시를 치려면 먼저 그 설치 토큰으로 브랜치 HEAD sha 를 받아야 하므로(tree.ts), 레포를 못 보는
// 설치는 여기까지 오지 못한다. 설치 id 는 그 위에 한 겹 더 둔 것이다.
//
// 캐시에 넣는 것은 GitHub 이 준 레포 내용뿐이다. 설치 토큰은 캐시된 함수 안에서 받고 결과에 담지 않는다.
// 실패는 캐시하지 않는다(캐시된 함수가 던지면 저장되지 않는다).

/** 내용이 안 바뀌니 오래 둬도 된다. 만료돼도 같은 값을 다시 받을 뿐이다. */
const TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * 캐시 한 항목 상한. Next 는 2MB 를 넘는 항목을 저장하지 않는다(dev 에선 던진다). 그 크기는 결과를
 * JSON 으로 한 번 더 감싼 캐시 항목 전체로 재므로, 우리도 두 번 감싼 길이로 재고 여유를 둔다.
 */
const MAX_ENTRY_CHARS = 1.8 * 1024 * 1024;

/** 너무 커서 캐시하지 않았다는 표시. 이 표시는 작으니 캐시된다 — 다음 요청은 곧장 직접 받는다. */
type TooLarge = { tooLargeToCache: true };

function isTooLarge(value: unknown): value is TooLarge {
  return typeof value === "object" && value !== null && "tooLargeToCache" in value;
}

/** 캐시 키. 설치 id 는 bigint 라 JSON 키에 못 넣어 문자열로 받는다. */
export type ContentKey = { installationId: string; owner: string; repo: string; sha: string };

/**
 * `fetch(key)` 결과를 `name` + key 로 캐시한다. 항목이 상한을 넘으면 캐시하지 않고 그대로 돌려준다.
 *
 * `fetch` 는 key 만 보고 결과를 만들어야 한다. 바깥 값을 쓰면 그 값은 키에 없어 다른 레포와 섞인다.
 */
export async function cachedByContent<T>(
  name: string,
  key: ContentKey,
  fetch: (key: ContentKey) => Promise<T>
): Promise<T> {
  // 이번 호출에서 받았는데 너무 커서 캐시하지 못한 값. 같은 걸 한 번 더 받지 않으려고 잡아 둔다.
  let fresh: { value: T } | undefined;
  const cached = unstable_cache(
    async (k: ContentKey): Promise<T | TooLarge> => {
      const value = await fetch(k);
      if (JSON.stringify(JSON.stringify(value) ?? "").length <= MAX_ENTRY_CHARS) return value;
      fresh = { value };
      return { tooLargeToCache: true };
    },
    ["github-content", name],
    { revalidate: TTL_SECONDS }
  );
  const result = await cached(key);
  if (!isTooLarge(result)) return result;
  return fresh ? fresh.value : fetch(key);
}
