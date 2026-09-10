import { isSnoozed, type NotificationSettings } from "@/lib/notifications/settings";

// "이 PR 에 우리가 뭐라도 쓸까"를 판정한다.
//
// 판정만 하고 아무것도 부르지 않는다(순수 함수). 이유는 두 가지다 — 웹훅과
// 미리보기가 같은 규칙을 봐야 하고, 건너뛴 이유를 그대로 전달 로그에 적어야
// 하기 때문이다. "왜 코멘트가 안 달렸지"의 답이 여기서 나온다.

/** 판정에 필요한 PR 쪽 사실. 웹훅 페이로드에서 이만큼만 뽑아 온다. */
export type PullRequestFacts = {
  /** 머지될 대상 브랜치 (base). head 가 아니다 */
  baseRef: string;
  /** 레포의 기본 브랜치. 필터가 비었을 때의 기준 */
  defaultBranch: string;
  draft: boolean;
  labels: string[];
  /** head 커밋 메시지. `[skip dante]` 를 찾는다. 모르면 null */
  headCommitMessage: string | null;
};

export type ScopeDecision = { write: true } | { write: false; reason: string };

/** 라벨 하나로 이 PR 만 조용히 시킨다. CI 봇들이 흔히 쓰는 방식과 같게. */
export const SKIP_LABEL = "skip-dante";

/** 커밋 메시지 관례. `[skip ci]` 를 흉내 낸다 */
const SKIP_COMMIT_MARKER = "[skip dante]";

export function evaluateScope(
  settings: NotificationSettings,
  pr: PullRequestFacts,
  now = new Date()
): ScopeDecision {
  // 스누즈가 가장 넓다. 대규모 리팩터링 기간에 "아무것도 쓰지 마"를 켠 상태라
  // 다른 조건을 볼 것도 없다. (분석은 계속 돈다 — 여기서 막는 건 쓰기뿐이다.)
  if (isSnoozed(settings, now)) {
    return { write: false, reason: `snoozed until ${settings.snoozedUntil?.toISOString()}` };
  }

  if (settings.skipDraftPr && pr.draft) {
    return { write: false, reason: "draft PR" };
  }

  if (pr.labels.some((label) => label.toLowerCase() === SKIP_LABEL)) {
    return { write: false, reason: `labelled ${SKIP_LABEL}` };
  }

  if (pr.headCommitMessage?.toLowerCase().includes(SKIP_COMMIT_MARKER)) {
    return { write: false, reason: `commit message says ${SKIP_COMMIT_MARKER}` };
  }

  if (!baseMatches(settings.branchFilters, pr.baseRef, pr.defaultBranch)) {
    return { write: false, reason: `base branch ${pr.baseRef} is not in the filter` };
  }

  return { write: true };
}

/** 필터가 비어 있으면 기본 브랜치로 가는 PR 만 본다 — 가장 조용한 기본값. */
export function baseMatches(filters: string[], baseRef: string, defaultBranch: string) {
  if (filters.length === 0) return baseRef === defaultBranch;
  return filters.some((pattern) => matchBranch(pattern, baseRef));
}

/**
 * `release/*` 정도만 되는 아주 작은 glob.
 *
 * minimatch 를 넣지 않는 이유: 우리가 필요한 건 `*` 하나뿐이고, 브랜치 이름에
 * `**` 나 문자 클래스를 쓰는 사람은 없다 (몇 줄로 될 일은 직접 — AGENTS.md).
 * `*` 는 `/` 를 포함해 나머지 전부에 붙는다 — `release/*` 가 `release/1/hotfix`
 * 에도 걸리는 편이, 안 걸려서 "왜 알림이 안 오지"가 되는 것보다 낫다.
 */
export function matchBranch(pattern: string, ref: string) {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("*")) return trimmed === ref;

  const source = trimmed
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${source}$`).test(ref);
}
