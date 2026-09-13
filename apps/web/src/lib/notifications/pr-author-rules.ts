// PR 작성자·Re-run 요청자 판정 결과 → 코멘트에 적을 사유. 순수 함수다.
//
// PR 에서 도는 테스트 생성의 AI 비용은 한 사람의 개인 한도로 센다(팀 한도는 없다).
// 푸시로 시작한 작업은 PR 작성자, Re-run 으로 다시 돌린 작업은 누른 사람이다.
// 그 사람이 이 팀의 Dante 사용자가 아니면 셀 한도가 없다. 누구 한도도 몰래 쓰지 않는다 —
// 레포를 연결한 사람 한도로 대신 세지 않는 이유는, 외부 기여자 PR 이 많은 레포에서
// 그 사람 한도가 조용히 바닥나기 때문이다.

export type PullRequestAuthor = {
  /** GitHub 사용자 숫자 ID. 로그인 핸들은 바뀌고 재사용될 수 있어 이걸로 찾는다 */
  githubId: number;
  login: string;
};

/**
 * AI 비용을 낼 사람.
 *
 * Re-run 을 누른 사람 한도로 세는 이유: 작성자가 아닌 사람이 여러 번 눌러 작성자 한도가
 * 빠지면 안 된다. GitHub 체크의 Re-run 은 레포 쓰기 권한만 있으면 누구나 누를 수 있다.
 */
export type Payer =
  /** 푸시·PR 열림. PR 작성자 */
  | { kind: "author" }
  /** GitHub 체크의 Re-run. 페이로드의 sender. 없으면 null */
  | { kind: "github-requester"; account: PullRequestAuthor | null }
  /** Dante 화면의 다시 실행. 로그인한 사용자 */
  | { kind: "dante-requester"; userId: string; login: string };

export type AuthorCheck =
  /** 페이로드에 작성자가 없었다 */
  | { kind: "unknown" }
  /** 이 GitHub 계정으로 가입한 Dante 사용자가 없거나, 프로젝트 팀의 멤버가 아니다 */
  | { kind: "not-member"; login: string }
  | { kind: "budget-exceeded"; login: string }
  /** 한도를 확인하지 못했다(설정 누락 등). 모르면 쓰지 않는다 */
  | { kind: "budget-unavailable"; login: string }
  | { kind: "ok"; userId: string };

/**
 * 건너뛸 사유. 진행해도 되면 null.
 *
 * 로그인 앞에 @ 를 붙이지 않는다. 코멘트에서 @ 는 멘션이라, 코멘트를 만들 때마다
 * 작성자에게 알림이 간다. 자기 PR 에 대한 안내라 알림까지 보낼 일은 아니다.
 */
export function authorSkipReason(check: AuthorCheck): string | null {
  switch (check.kind) {
    case "ok":
      return null;
    case "unknown":
      return "Dante could not tell who opened this pull request, so it skipped test generation.";
    case "not-member":
      return `The author (${check.login}) is not a member of this project's team on Dante, so Dante skipped test generation. AI usage is billed to the pull request author.`;
    case "budget-exceeded":
      return `The author (${check.login}) has used up this month's AI budget, so Dante skipped test generation.`;
    case "budget-unavailable":
      return `Dante could not check the AI budget for the author (${check.login}), so it skipped test generation.`;
  }
}

/**
 * 비용을 낼 수 없을 때 이 작업을 어떻게 끝낼지.
 *
 * 작성자는 지금처럼 건너뛴다(skipped). 외부 기여자 PR 을 실패로 만들면 머지가 막힌다.
 * Re-run 요청자는 권한이 없으면 실패(failed)로 끝낸다 — 누른 사람이 결과로 알아야 하고,
 * 한도 초과처럼 본인이 풀 수 있는 사유는 작성자와 같이 건너뛴다.
 */
export function payerOutcome(
  check: Exclude<AuthorCheck, { kind: "ok" }>,
  payer: Payer
): { status: "skipped"; skipReason: string } | { status: "failed"; error: string } {
  if (payer.kind === "author") {
    return { status: "skipped", skipReason: authorSkipReason(check) ?? "" };
  }

  switch (check.kind) {
    case "unknown":
      return {
        status: "failed",
        error: "Dante could not tell who requested this re-run, so it did not run.",
      };
    case "not-member":
      return {
        status: "failed",
        error: `The re-run was requested by ${check.login}, who is not a member of this project's team on Dante, so it did not run. AI usage for a re-run is billed to the person who requested it.`,
      };
    case "budget-exceeded":
      return {
        status: "skipped",
        skipReason: `${check.login}, who requested this re-run, has used up this month's AI budget, so Dante skipped test generation.`,
      };
    case "budget-unavailable":
      return {
        status: "skipped",
        skipReason: `Dante could not check the AI budget for ${check.login}, who requested this re-run, so it skipped test generation.`,
      };
  }
}
