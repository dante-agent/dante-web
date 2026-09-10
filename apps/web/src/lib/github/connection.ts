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

// ── 화면에 뭐라고 쓸까 ──────────────────────────────────────────────────────
//
// 판정(위)과 문구를 같은 파일에 둔다. 상태를 하나 늘릴 때 문구를 빠뜨리면
// 배너가 조용히 비는데, 한 파일에 있으면 switch 가 빠진 가지를 컴파일 단계에서
// 잡아준다.

/** 배너의 톤. 되돌릴 수 있는 일과 끝난 일을 가른다. */
export type ConnectionTone =
  /** 사용자가 GitHub 에서 몇 번 눌러 되돌릴 수 있다 */
  | "warning"
  /** 되돌릴 방법이 없다 */
  | "danger";

export type ConnectionNotice = {
  tone: ConnectionTone;
  title: string;
  /** 다음에 뭘 눌러야 하는지로 끝난다. 상태 이름만 옮겨 적지 않는다. */
  body: string;
  action: {
    label: string;
    href: string;
    /**
     * 링크를 어떻게 걸어야 하는지. 셋을 구분하는 이유가 각각 다르다.
     *   github  GitHub 으로 나간다 → 새 탭 (고치고 돌아올 화면을 잃지 않게)
     *   route   우리 라우트 핸들러(/api/...) → 같은 탭의 <a>. <Link> 는 페이지가
     *           아닌 경로로 클라이언트 이동을 시도한다
     *   page    앱 안의 페이지 → <Link>
     */
    kind: "github" | "route" | "page";
  };
};

/** 문구에 박아 넣을 값들. 페이지가 이미 읽어둔 것만 받는다. */
export type ConnectionContext = {
  /** 설치가 붙은 GitHub 계정 (개인 또는 조직) */
  accountLogin: string;
  repoOwner: string;
  repoName: string;
  /**
   * GitHub 설치 설정 URL.
   *
   * 만드는 함수(`installationSettingsUrl`)는 `lib/github/app.ts` 에 있지만 그
   * 파일은 서버 전용(App private key 를 읽는다)이다. 여기서 import 하면 이
   * 파일도 같이 서버 전용이 되므로, 호출부가 결과 문자열만 넣어준다.
   */
  installationSettingsUrl: string;
  /** 설정 경로를 만드는 데 쓴다 (/project/<ref>/settings/...) */
  projectRef: string;
};

/**
 * 상태 하나를 배너 하나로 편다.
 *
 * `ok` 는 null 이다 — 정상인데 "정상입니다"를 띄우면 나머지 넷의 경고가 묻힌다.
 */
export function connectionNotice(
  status: ConnectionStatus,
  context: ConnectionContext
): ConnectionNotice | null {
  const { accountLogin, repoOwner, repoName, installationSettingsUrl, projectRef } = context;
  const repo = `${repoOwner}/${repoName}`;

  switch (status) {
    case "ok":
      return null;

    case "suspended":
      return {
        tone: "warning",
        title: "GitHub suspended this installation",
        // 넷 중 유일하게 "여기서는 못 푼다"를 명시한다. 재설치를 시도하게 두면
        // 헛수고고, GitHub 에서 풀리면 웹훅이 알아서 되돌린다.
        body: "This usually comes from billing or an organization policy. Clearing it on GitHub brings the connection back on its own — there is nothing to reconnect here.",
        action: { label: "Open on GitHub", href: installationSettingsUrl, kind: "github" },
      };

    case "app_removed":
      return {
        tone: "warning",
        title: `The Dante App was removed from @${accountLogin}`,
        body: "Install it again to read this repository.",
        // GitHub 설치 화면으로 바로 보내지 않는다. 우리 라우트가 CSRF 용 state
        // 쿠키를 심은 뒤 보내야 돌아왔을 때 대조할 값이 있다.
        action: { label: "Reinstall", href: "/api/github/install", kind: "route" },
      };

    case "repo_removed":
      return {
        tone: "warning",
        title: `${repo} is no longer shared with the App`,
        body: "The App itself is still installed. Pick this repository again in the GitHub installation settings and the connection comes back.",
        action: { label: "Fix on GitHub", href: installationSettingsUrl, kind: "github" },
      };

    case "repo_deleted":
      return {
        tone: "danger",
        title: `${repo} no longer exists on GitHub`,
        body: "There is no way back — this project has nothing left to read. Deleting it is all that is left to do.",
        action: {
          label: "Delete project",
          href: `/project/${projectRef}/settings/general`,
          kind: "page",
        },
      };
  }
}
