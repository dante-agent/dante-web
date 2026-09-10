import { NextResponse } from "next/server";
import { prisma } from "@dante/db";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { githubIdentity, syncUser } from "@/lib/auth/user";
import { fetchInstallation } from "@/lib/github/app";
import { listInstallationRepos } from "@/lib/github/repos";
import { INSTALL_STATE_COOKIE, matchesState } from "@/lib/github/state";
import { createClient } from "@/lib/supabase/server";

// GitHub App 설치가 끝나면 GitHub 이 여기로 돌려보낸다 (App 설정의 Setup URL).
// 쿼리로 installation_id, setup_action, state 가 온다.
//
// "Redirect on update" 를 켜뒀으므로 레포를 추가·제거한 뒤에도 여기로 온다.

/** 레포를 고르는 화면. 성공·실패 모두 여기로 돌려보낸다. */
const REPO_PICKER_PATH = "/projects/new/github";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const back = (params?: Record<string, string>) => {
    const target = new URL(REPO_PICKER_PATH, request.url);
    for (const [key, value] of Object.entries(params ?? {})) {
      target.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(target);
    // 성공이든 실패든 state 는 1회용이다. 남겨두면 재사용될 수 있다.
    response.cookies.delete(INSTALL_STATE_COOKIE);
    return response;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // 1) 우리 사이트에서 시작된 설치인가
  const expected = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${INSTALL_STATE_COOKIE}=`))
    ?.slice(INSTALL_STATE_COOKIE.length + 1);

  if (!matchesState(url.searchParams.get("state"), expected)) {
    return back({ error: "state" });
  }

  // 2) 조직 레포는 관리자 승인이 필요할 수 있다. 그때는 설치가 아직 없다.
  if (url.searchParams.get("setup_action") === "request") {
    return back({ notice: "requested" });
  }

  const installationId = Number(url.searchParams.get("installation_id"));
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return back({ error: "installation" });
  }

  // 3) 그 설치가 실재하는지 App 자격(JWT)으로 직접 확인한다.
  //    쿼리스트링 값을 그대로 믿고 저장하지 않는다.
  let installation;
  try {
    installation = await fetchInstallation(installationId);
  } catch {
    return back({ error: "installation" });
  }

  const account = installation.account;
  if (!account || !("login" in account)) {
    // Enterprise 계정에는 login 이 없다. 우리는 개인·조직만 지원한다.
    return back({ error: "account" });
  }

  // 4) 개인 계정 설치라면 로그인한 사람 본인 것이어야 한다.
  //    조직은 여기서 확인할 수 없어(멤버십 조회에 사용자 토큰이 필요) state 로만 막는다.
  const github = githubIdentity(user);
  if (account.type === "User" && github.id !== null && BigInt(account.id) !== github.id) {
    return back({ error: "mismatch" });
  }

  await syncUser(user);

  const fields = {
    userId: user.id,
    accountLogin: account.login,
    accountId: BigInt(account.id),
    accountType: account.type ?? "User",
    suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
  };

  await prisma.githubInstallation.upsert({
    where: { id: BigInt(installationId) },
    create: { id: BigInt(installationId), ...fields },
    update: fields,
  });

  await relinkProjects(user.id, installationId);

  return back({ installation_id: String(installationId) });
}

/**
 * 이 설치가 열어준 레포를 쓰는 기존 프로젝트를 이 설치로 옮긴다.
 *
 * 앱을 지웠다 다시 설치하면 GitHub 이 설치 ID 를 새로 발급한다. 위 upsert 는 새
 * 행을 만들 뿐이라, 기존 프로젝트는 지워진 옛 설치를 가리킨 채 남는다. 그러면
 * 설정 화면은 영원히 "The Dante App was removed" 를 띄우고 — 다시 설치해도
 * 바뀌지 않는다 — 레포 고르기 화면에서는 이미 프로젝트라 Import 도 못 한다.
 * 빠져나갈 길이 없어지므로 여기서 이어 붙인다.
 *
 * 레포를 추가·제거한 뒤에도 여기로 오므로(Redirect on update), 설치에서 뺐다가
 * 다시 열어준 레포도 이 경로로 되살아난다.
 *
 * repoId 로만 찾고 userId 로 거른다. repoId 는 GitHub 것이라 남의 프로젝트와
 * 겹칠 수 있다 — 같은 공개 레포를 둘이 각자 연결한 경우다.
 */
async function relinkProjects(userId: string, installationId: number) {
  let repos;
  try {
    repos = await listInstallationRepos(installationId);
  } catch {
    // 설치 자체는 이미 저장했다. 목록 조회가 실패했다고 설치까지 실패로
    // 돌려보내면 사용자는 방금 끝낸 설치를 처음부터 다시 하게 된다. 레포를
    // 고치러 GitHub 을 한 번 더 다녀오면 여기로 다시 오므로, 조용히 넘어간다.
    return;
  }

  const repoIds = repos.map((repo) => BigInt(repo.id));
  if (repoIds.length === 0) return;

  await prisma.project.updateMany({
    where: { userId, repoId: { in: repoIds } },
    data: {
      installationId: BigInt(installationId),
      disconnectedAt: null,
      disconnectedReason: null,
    },
  });
}
