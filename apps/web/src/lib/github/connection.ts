// 프로젝트 하나의 "지금 GitHub 에 붙어 있나"를 한 값으로 접는다.
//
// 상태가 두 군데에 나뉘어 적히기 때문에 필요한 파일이다:
//   GithubInstallation  설치 전체에 걸린 일 (앱 삭제, 정지)
//   Project             그 레포 하나에만 걸린 일 (설치에서 뺌, 레포 삭제)
// 나눠 적는 이유는 schema.prisma 주석 참고 — 요약하면 설치 단위 사실을 프로젝트
// 행마다 복사해 두면 되돌릴 때 전부 훑어야 한다.
//
// 값을 채우는 건 웹훅(lib/github/webhook.ts)이다. 웹훅은 배달이 늦거나 빠질 수
// 있으니 이 값을 권한 검사에 쓰면 안 된다 — 실제 접근 권한은 GitHub 이 설치
// 토큰을 내주느냐로 결정된다. 여기는 어디까지나 "화면에 뭐라고 쓸까"용이다.

export type ConnectionStatus =
  /** 정상 */
  | "ok"
  /** GitHub 이 설치를 정지시킴 (보통 결제·정책 문제). 풀리면 저절로 돌아온다 */
  | "suspended"
  /** 사용자가 GitHub 에서 앱을 지움. 다시 설치해야 하고 설치 ID 도 새로 발급된다 */
  | "app_removed"
  /** 앱은 그대로인데 이 레포만 설치 선택에서 빠짐. 다시 열어주면 복구된다 */
  | "repo_removed"
  /** 레포 자체가 GitHub 에서 사라짐. 복구할 방법이 없다 */
  | "repo_deleted";

/** 상태를 판정하는 데 필요한 최소 필드. Prisma select 를 이 모양으로 맞추면 된다. */
export type ProjectConnection = {
  disconnectedAt: Date | null;
  disconnectedReason: string | null;
  installation: {
    suspendedAt: Date | null;
    deletedAt: Date | null;
  };
};

/**
 * 넓은 사유가 이긴다. 앱을 통째로 지웠다면 "레포가 빠졌다"고 말해봐야
 * 사용자가 할 일(= 앱 재설치)을 못 찾는다.
 */
export function projectConnection(project: ProjectConnection): ConnectionStatus {
  if (project.installation.deletedAt) return "app_removed";
  if (project.installation.suspendedAt) return "suspended";

  if (project.disconnectedAt) {
    // 사유를 못 알아보면 "레포가 빠졌다"로 둔다 — 둘 중 되돌릴 수 있는 쪽이라,
    // 틀렸더라도 사용자를 막다른 길로 보내지는 않는다.
    return project.disconnectedReason === "repo_deleted" ? "repo_deleted" : "repo_removed";
  }

  return "ok";
}
