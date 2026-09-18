import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { prisma } from "@dante/db";
import { GitHubIcon } from "@/components/brand-icons";
import { BackLink } from "@/components/projects/back-link";
import { RepoPicker } from "@/components/projects/repo-picker";
import { StepHeader } from "@/components/projects/step-header";
import { buttonVariants } from "@/components/ui/button";
import { accessibleInstallationWhere, accessibleProjectWhere } from "@/lib/teams/access";
import { requireCurrentTeam } from "@/lib/teams/current";
import { installationSettingsUrl } from "@/lib/github/app";
import { cachedInstallationRepos, type InstallationRepo } from "@/lib/github/repos";

export const metadata: Metadata = { title: "Choose repository" };

// 온보딩 2단계 — GitHub 레포 고르기.
//
// 설치가 없으면 설치로 보내고, 있으면 그 설치들이 열어준 레포를 모아서 보여준다.
export default async function GitHubConnectPage({
  searchParams,
}: PageProps<"/projects/new/github">) {
  // 레포는 지금 팀의 설치에서만 고른다. 새 프로젝트는 설치의 팀에 붙으므로(actions.ts),
  // 다른 팀 설치의 레포를 보여주면 목록에 안 보이는 팀에 프로젝트가 생긴다.
  const { user, teamId } = await requireCurrentTeam();

  // searchParams 값은 같은 키가 여러 번 오면 배열이 된다. 첫 값만 쓴다.
  const params = await searchParams;
  const error = first(params.error);
  const notice = first(params.notice);
  // 설치를 막 끝내고 돌아온 경우 /api/github/setup 이 붙여준다. 그 계정을 골라둔다.
  const installedId = first(params.installation_id);

  // 지워진 설치(deletedAt)는 뺀다. 행은 남겨두지만 — 프로젝트가 참조를 잃으면
  // 통째로 사라진다(onDelete: Cascade) — GitHub 에 물어보면 실패라서, 남겨두면
  // 재설치하고 돌아온 사용자에게 "일부 설치의 레포를 못 읽었다" 빨간 배너가 뜬다.
  const connected = await prisma.githubInstallation.findMany({
    where: {
      teamId,
      ...accessibleInstallationWhere(user.id),
      suspendedAt: null,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, accountLogin: true, accountType: true },
  });

  // 이미 프로젝트로 만든 레포는 다시 고를 수 없게 표시한다.
  const projects = await prisma.project.findMany({
    where: accessibleProjectWhere(user.id),
    select: { ref: true, repoId: true },
  });
  const refByRepoId = new Map(projects.map((p) => [p.repoId.toString(), p.ref]));

  // 설치별로 GitHub 에 물어본다. 하나가 실패해도(설치 취소·권한 변경) 나머지는 보여준다.
  // 결과는 잠깐 캐시한다(lib/github/repos.ts) — 레포가 바뀌면 웹훅·setup 이 비운다.
  const results = await Promise.allSettled(
    connected.map((installation) => cachedInstallationRepos(Number(installation.id)))
  );

  const repos: InstallationRepo[] = [];
  const installationIdByRepoId = new Map<number, bigint>();

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    for (const repo of result.value) {
      repos.push(repo);
      installationIdByRepoId.set(repo.id, connected[index].id);
    }
  });

  // 401·404 는 "GitHub 에 그 설치가 없다" — 앱을 지웠는데 웹훅을 놓친 경우다.
  // 두 코드가 갈리는 건 설치 토큰이 캐시에 남아 있었느냐 뿐이다. 새로 발급받으려
  // 하면 없는 설치라 404 가 오고, 아직 살아 있을 때 받아둔 토큰을 그대로 쓰면
  // GitHub 이 삭제 시점에 폐기해버려 401 이 온다. 같은 사실을 말하는 두 얼굴이라
  // 둘 다 받는다 (설정 화면의 recordFailure 와 같은 규칙).
  //
  // 행에 deletedAt 을 적어두지 않으면 방문할 때마다 같은 실패로 빨간 배너가 다시
  // 뜨고, 사라진 설치의 GitHub 설정 화면으로 가는 링크가 계속 그려진다 — 눌러도
  // 404 다. 5xx·레이트리밋·네트워크 오류에는 적지 않는다. 잠깐의 장애를 영구
  // 표시로 굳히면 되돌릴 길이 없다.
  const gone = results.map((r) => {
    if (r.status !== "rejected") return false;
    const status = httpStatus(r.reason);
    return status === 401 || status === 404;
  });
  const goneIds = connected.filter((_, index) => gone[index]).map((i) => i.id);

  if (goneIds.length > 0) {
    await prisma.githubInstallation.updateMany({
      where: { id: { in: goneIds }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // 방금 지운 설치는 이번 렌더에서도 없는 셈 친다. 남겨두면 계정 목록과 설정 URL
  // 에 그대로 남아, 하나도 안 남은 사용자에게 "레포가 없다"는 빈 목록과 404 링크를
  // 보여주게 된다. 지금 필요한 안내는 "앱을 다시 설치해라"다.
  const installations = connected.filter((_, index) => !gone[index]);

  // 지워진 설치는 배너에서 뺀다. 방금 deletedAt 을 적어서 다음 방문에는 목록에서
  // 아예 빠지므로, 이번 방문만 다르게 보일 이유가 없다.
  const failed = results.some((r, index) => r.status === "rejected" && !gone[index]);

  // "ADD ONE ON GITHUB" 는 지금 고른 계정의 설치 화면으로 가야 한다. 계정마다
  // URL 이 다르고, 남의 org 설치 화면은 사용자에게 404 로 보인다 (app.ts 주석).
  const settingsUrlByInstallationId = Object.fromEntries(
    installations.map((installation) => [
      installation.id.toString(),
      installationSettingsUrl(installation),
    ])
  );

  const initialOwner =
    installations.find((installation) => installation.id.toString() === installedId)
      ?.accountLogin ?? "";

  return (
    <>
      <div className="mb-6">
        <BackLink href="/projects/new">Change provider</BackLink>
      </div>

      <StepHeader
        title="Which repository?"
        description="One is enough to start. You can add more projects later"
      />

      {error && <Banner tone="error">{errorMessage(error)}</Banner>}
      {notice === "requested" && (
        <Banner tone="notice">
          Requested approval from your organization owner. Repositories appear here once approved.
        </Banner>
      )}
      {failed && !error && (
        <Banner tone="error">
          Could not load repositories from some installations. Check that the connection is still
          active on GitHub.
        </Banner>
      )}

      <div className="mt-8">
        {installations.length === 0 ? (
          <ConnectPrompt />
        ) : (
          <RepoPicker
            repos={repos}
            refByRepoId={Object.fromEntries(refByRepoId)}
            installationIdByRepoId={Object.fromEntries(
              [...installationIdByRepoId].map(([repoId, id]) => [repoId, id.toString()])
            )}
            settingsUrlByInstallationId={settingsUrlByInstallationId}
            initialOwner={initialOwner}
          />
        )}
      </div>
    </>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Octokit 이 던지는 RequestError 의 status. 다른 예외면 null. */
function httpStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = (error as { status: unknown }).status;
  return typeof status === "number" ? status : null;
}

function errorMessage(code: string) {
  switch (code) {
    case "state":
      // 대개는 공격이 아니라 오래 걸렸거나 다른 탭에서 시작한 경우다.
      return "Could not verify the installation. It may have taken too long — please try again.";
    case "mismatch":
      return "The GitHub account you installed with is not the one you signed in with.";
    case "account":
      return "Enterprise accounts are not supported yet.";
    case "taken":
      // 설치 1건은 팀 1개만 가진다(api/github/setup). 가져가게 두면 남의 프로젝트가 옮겨 온다.
      return "This GitHub installation is already connected to another team. Ask someone on that team to invite you.";
    case "repo_taken":
      // 레포는 전역에서 프로젝트 하나다(new/github/actions.ts). 설치와 같은 안내를 한다.
      return "This repository is already a project on another team. Ask someone on that team to invite you.";
    case "installation":
      // installation_id 가 없거나 GitHub 에 그 설치가 없다. 설치를 중간에 취소했거나
      // Setup URL 을 직접 열어본 경우다.
      return "Could not confirm the installation on GitHub. Please try installing again.";
    default:
      return "Could not load the GitHub installation. Please try again.";
  }
}

// 상태 색은 DESIGN.md §1 을 따른다 — 오류는 destructive, 안내는 Cobalt(정보).
// 각진 테두리 대신 왼쪽 굵은 선만 쓴다. 배너가 패널처럼 보이면 시선을 뺏는다.
function Banner({ tone, children }: { tone: "error" | "notice"; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className={`mt-6 border-l-2 py-1 pl-4 text-[13px] leading-relaxed ${
        tone === "error"
          ? "border-destructive text-destructive"
          : "border-brand-cobalt text-brand-cobalt"
      }`}
    >
      {children}
    </p>
  );
}

// 설치가 하나도 없을 때. OAuth 가 아니라 App 설치인 이유는 레포 단위로 권한을
// 고를 수 있고, 우리가 사용자 토큰을 저장하지 않아도 되기 때문이다.
function ConnectPrompt() {
  return (
    <div className="border-border bg-card border p-6">
      <div className="flex items-center gap-4">
        <GitHubIcon className="size-6 shrink-0" />
        <span className="font-heading flex-1 text-lg leading-tight font-medium">
          Install the GitHub App
        </span>
      </div>
      <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
        You will pick which repositories to open on GitHub, then land back here. You can change or
        revoke it any time in GitHub settings.
      </p>

      {/* 서버 라우트가 state 쿠키를 심고 GitHub 설치 화면으로 보낸다. */}
      <a
        href="/api/github/install"
        className={buttonVariants({ size: "lg", className: "group mt-5 w-full rounded-[4px]" })}
      >
        <GitHubIcon />
        Connect GitHub
        <ArrowRight className="transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </a>

      <div className="border-border mt-5 border-t pt-3">
        <p className="text-muted-foreground font-mono text-[10px] tracking-wide">
          WE NEVER STORE ACCESS TOKENS · ISSUED FOR ONE HOUR WHEN NEEDED
        </p>
      </div>
    </div>
  );
}
