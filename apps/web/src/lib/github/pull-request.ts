import { githubApp } from "@/lib/github/app";
import { COMMENT_MARKER_PREFIX } from "@/lib/notifications/comment";
import { CHECK_RUN_NAME, type CheckRunResult } from "@/lib/notifications/check-run";

// ⚠️ 서버 전용 (app.ts 참고).
//
// PR 에 실제로 쓰는 쪽. 두 표면을 만든다.
//
//   issue comment  PR 대화 탭에 붙는 요약. `pull_requests: write` 필요
//   check run      PR 하단 체크 목록의 판정.  `checks: write` 필요
//
// PR 코멘트는 issue comment API 로 만든다. PR 의 "review comment"(코드 줄에
// 다는 것)는 다른 엔드포인트고 이번 범위가 아니다.

export type Octokit = Awaited<ReturnType<ReturnType<typeof githubApp>["getInstallationOctokit"]>>;

export function installationClient(installationId: bigint | number) {
  return githubApp().getInstallationOctokit(Number(installationId));
}

/**
 * 설치 토큰 원문. runner 가 private 레포를 클론할 때 넘긴다.
 *
 * Octokit 클라이언트가 아니라 문자열이 필요한 자리는 여기뿐이다. 1시간 뒤 만료되고,
 * 권한은 설치에 준 것 그대로다.
 */
export async function installationToken(installationId: bigint | number) {
  const { data } = await githubApp().octokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    { installation_id: Number(installationId) }
  );
  return data.token;
}

export type RepoRef = { owner: string; repo: string };

/**
 * GitHub 이 돌려준 에러에서 상태 코드만 꺼낸다.
 *
 * Octokit 의 RequestError 클래스를 import 하지 않는 이유는 octokit 의 하위
 * 의존성이라 pnpm 격리 구조에서 apps/web 이 직접 못 보기 때문이다
 * (lib/github/webhook.ts 의 서명 검증과 같은 사정).
 */
export function errorStatus(error: unknown) {
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

/** 로그·화면에 그대로 보여줄 한 줄. "403 Resource not accessible by integration". */
export function errorDetail(error: unknown) {
  const status = errorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return status ? `${status} — ${message}` : message;
}

/**
 * 요약 코멘트를 만들거나 고친다.
 *
 * sticky 모드에서 코멘트를 찾는 순서 (§3.1):
 *   1. DB 에 캐시된 commentId 로 바로 수정 — 대부분 여기서 끝난다
 *   2. 404 면 사람이 지운 것이다. 코멘트 목록에서 마커로 다시 찾는다
 *   3. 그래도 없으면 새로 만든다
 *
 * @returns 이번에 쓴 코멘트의 ID. 호출부가 DB 캐시를 갱신한다.
 */
export async function upsertSummaryComment(
  octokit: Octokit,
  ref: RepoRef,
  prNumber: number,
  body: string,
  options: { mode: "sticky" | "append"; cachedCommentId: number | null }
): Promise<number> {
  // append 모드는 이력이 남는 걸 선호하는 팀을 위한 옵션이다. 찾지 않고 그냥 단다.
  if (options.mode === "append") return createComment(octokit, ref, prNumber, body);

  if (options.cachedCommentId !== null) {
    try {
      await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        ...ref,
        comment_id: options.cachedCommentId,
        body,
      });
      return options.cachedCommentId;
    } catch (error) {
      // 404 = 지워졌다. 그 외(권한·레이트 리밋)는 삼키면 안 된다 — 새 코멘트를
      // 하나 더 만들어서 문제를 덮는 꼴이 된다.
      if (errorStatus(error) !== 404) throw error;
    }
  }

  const found = await findSummaryComment(octokit, ref, prNumber);
  if (found !== null) {
    await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
      ...ref,
      comment_id: found,
      body,
    });
    return found;
  }

  return createComment(octokit, ref, prNumber, body);
}

async function createComment(octokit: Octokit, ref: RepoRef, prNumber: number, body: string) {
  const { data } = await octokit.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    { ...ref, issue_number: prNumber, body }
  );
  // Octokit 은 ID 를 number|bigint 로 타이핑하지만 실제 값은 2^53 안쪽이다
  // (lib/github/repos.ts 와 같은 판단).
  return Number(data.id);
}

/**
 * 우리가 예전에 단 요약 코멘트를 마커로 찾는다.
 *
 * 마커만으로 고르지 않고 작성자가 우리 App 인지도 본다. 마커는 본문에 보이는
 * 문자열이라 누구나 복사해 붙일 수 있는데, 그걸 우리 코멘트로 착각하면 남의
 * 글을 덮어쓴다.
 */
export async function findSummaryComment(octokit: Octokit, ref: RepoRef, prNumber: number) {
  const slug = process.env.GITHUB_APP_SLUG;
  // 접두사로 본다. ref 가 붙은 옛 마커 코멘트도 우리 것으로 찾아 이어서 고쳐 쓴다.
  // 레포당 프로젝트가 하나라 다른 프로젝트의 코멘트와 헷갈릴 일이 없다.
  const marker = COMMENT_MARKER_PREFIX;

  // 페이지를 직접 넘긴다. octokit 의 paginate 헬퍼는 설치 토큰용 클라이언트
  // 타입에 노출되지 않아서, repos.ts 와 같은 방식으로 훑는다.
  //
  // 대화가 아주 긴 PR 에서 끝없이 읽지 않게 5페이지(500개)에서 끊는다. 우리
  // 코멘트는 PR 초반에 달리므로 여기서 못 찾으면 정말 없다고 봐도 된다.
  for (let page = 1; page <= 5; page++) {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { ...ref, issue_number: prNumber, per_page: 100, page }
    );

    for (const comment of data) {
      if (!comment.body?.includes(marker)) continue;
      if (slug && comment.performed_via_github_app?.slug !== slug) continue;
      if (!slug && comment.user?.type !== "Bot") continue;
      return Number(comment.id);
    }

    if (data.length < 100) break;
  }

  return null;
}

/**
 * 체크를 만들거나 고친다.
 *
 * 코멘트와 달리 체크는 커밋(head SHA)에 붙는다. 그래서 푸시가 오면 같은 체크를
 * 고치는 게 아니라 새 SHA 에 새로 만들어야 한다 — 캐시된 ID 로 PATCH 를 시도하고
 * 404 면 새로 만드는 이유가 여기 있다.
 */
export async function upsertCheckRun(
  octokit: Octokit,
  ref: RepoRef,
  headSha: string,
  result: CheckRunResult,
  options: { cachedCheckRunId: number | null; detailsUrl: string | null }
): Promise<number> {
  const payload = {
    ...ref,
    name: CHECK_RUN_NAME,
    status: result.status,
    ...(result.conclusion ? { conclusion: result.conclusion } : {}),
    ...(options.detailsUrl ? { details_url: options.detailsUrl } : {}),
    output: { title: result.title, summary: result.summary },
  };

  if (options.cachedCheckRunId !== null) {
    try {
      const { data } = await octokit.request(
        "PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}",
        { ...payload, check_run_id: options.cachedCheckRunId }
      );
      // 커밋이 바뀌었으면 이 체크는 옛 SHA 의 것이다. 새로 만든다.
      if (data.head_sha === headSha) return Number(data.id);
    } catch (error) {
      if (errorStatus(error) !== 404) throw error;
    }
  }

  const { data } = await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
    ...payload,
    head_sha: headSha,
  });
  return Number(data.id);
}

/**
 * PR 하나의 현재 모습.
 *
 * `check_run.rerequested`(Re-run 버튼)로 들어올 때는 페이로드에 PR 번호와 SHA
 * 밖에 없어서, 브랜치 필터·드래프트 판정에 필요한 나머지를 여기서 읽는다.
 */
export async function fetchPullRequest(octokit: Octokit, ref: RepoRef, prNumber: number) {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    ...ref,
    pull_number: prNumber,
  });

  return {
    number: data.number,
    headSha: data.head.sha,
    baseRef: data.base.ref,
    draft: data.draft ?? false,
    labels: data.labels.map((label) => label.name),
    // Octokit 은 ID 를 number|bigint 로 타이핑하지만 실제 값은 2^53 안쪽이다 (createComment 와 같은 판단).
    author: data.user ? { githubId: Number(data.user.id), login: data.user.login } : null,
  };
}

/**
 * PR 에서 바뀐 파일 목록.
 *
 * GitHub 은 이 엔드포인트에서 최대 3,000개까지만 준다. 그보다 큰 PR 은 어차피
 * 사람도 리뷰하지 못하는 크기라 잘린 목록으로 판단한다.
 */
export async function fetchPullRequestFiles(octokit: Octokit, ref: RepoRef, prNumber: number) {
  const files: { filename: string; status: string }[] = [];

  for (let page = 1; page <= 30; page++) {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
      ...ref,
      pull_number: prNumber,
      per_page: 100,
      page,
    });

    for (const file of data) files.push({ filename: file.filename, status: file.status });
    if (data.length < 100) break;
  }

  return files;
}

/**
 * 특정 커밋 시점의 파일 텍스트.
 *
 * 못 읽으면 null 이다 — 없는 파일, 1MB 초과(contents API 가 내용을 안 준다), 권한 문제가
 * 전부 여기로 온다. lib/github/blob.ts 와 같은 API 지만 그쪽은 기본 브랜치를 읽고,
 * 여기는 PR head 처럼 아직 머지되지 않은 커밋을 읽는다.
 */
export async function fetchFileText(octokit: Octokit, ref: RepoRef, path: string, sha: string) {
  try {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      ...ref,
      path,
      ref: sha,
    });
    if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * head 커밋 메시지. `[skip dante]` 를 찾는 데만 쓴다.
 *
 * pull_request 페이로드에는 커밋 메시지가 없어서 한 번 더 물어봐야 한다.
 * 못 읽으면 null 을 준다 — 커밋 메시지를 몰라서 알림을 건너뛰는 것보다,
 * 모르면 평소대로 보내는 쪽이 덜 놀랍다.
 */
export async function fetchHeadCommitMessage(octokit: Octokit, ref: RepoRef, sha: string) {
  try {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
      ...ref,
      ref: sha,
    });
    return data.commit.message;
  } catch {
    return null;
  }
}

/**
 * 이 브랜치에서 `dante` 가 required check 로 걸려 있는지.
 *
 * 왜 필요한가: "테스트 실패 시 머지 차단"을 켜도 우리가 머지를 막지는 못한다.
 * 실제 차단은 레포 쪽 설정이라, 그게 안 돼 있으면 "켰는데 왜 안 막지?" 문의가
 * 온다. 화면에서 지금 상태를 보여주려고 읽는다.
 *
 * "unknown" 을 따로 두는 이유: 우리 App 에는 레포 설정을 읽을 권한
 * (`administration: read`)이 없다. 룰셋 쪽은 메타데이터만으로 읽히지만 예전
 * 방식(classic branch protection)은 그렇지 않아서, 모를 때는 모른다고 해야
 * 한다 — "안 걸려 있음"으로 단정하면 이미 잘 걸어둔 팀에게 거짓 경고를 낸다.
 *
 * 조회가 실패하면 "unknown" 을 돌려주지 않고 던진다. 호출부가 이 결과를 몇 분
 * 캐시하는데(lib/github/lookup-cache.ts), 실패를 결과로 돌려주면 그 실패가 캐시에
 * 남는다. 던지면 캐시되지 않고, 호출부가 "unknown" 으로 접는다.
 */
export async function checkRequiredStatus(
  octokit: Octokit,
  ref: RepoRef,
  branch: string
): Promise<"required" | "not_required" | "unknown"> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/rules/branches/{branch}", {
    ...ref,
    branch,
  });

  for (const rule of data) {
    if (rule.type !== "required_status_checks") continue;
    const checks = rule.parameters?.required_status_checks ?? [];
    if (checks.some((check) => check.context === CHECK_RUN_NAME)) return "required";
  }

  // 룰셋에 없다고 끝이 아니다. classic branch protection 은 이 엔드포인트에
  // 안 나오고, 그걸 읽으려면 우리에게 없는 권한이 필요하다.
  return "unknown";
}
