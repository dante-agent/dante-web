import { NextResponse } from "next/server";
import { prisma } from "@dante/db";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { githubIdentity, syncUser } from "@/lib/auth/user";
import { fetchInstallation } from "@/lib/github/app";
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

  return back({ installation_id: String(installationId) });
}
