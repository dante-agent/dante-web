// PR 작성자 판정 결과 → 코멘트에 적을 건너뜀 사유. 순수 함수다.
//
// PR 에서 도는 테스트 생성의 AI 비용은 PR 작성자 개인 한도로 센다(팀 한도는 없다).
// 그래서 작성자가 이 팀의 Dante 사용자가 아니면 셀 한도가 없고, 생성을 건너뛴다.
// 누구 한도도 몰래 쓰지 않는다 — 레포를 연결한 사람 한도로 대신 세지 않는 이유는,
// 외부 기여자 PR 이 많은 레포에서 그 사람 한도가 조용히 바닥나기 때문이다.

export type PullRequestAuthor = {
  /** GitHub 사용자 숫자 ID. 로그인 핸들은 바뀌고 재사용될 수 있어 이걸로 찾는다 */
  githubId: number;
  login: string;
};

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
