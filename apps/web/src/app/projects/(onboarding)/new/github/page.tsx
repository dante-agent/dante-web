import { ArrowRight } from "lucide-react";
import { prisma } from "@dante/db";
import { GitHubIcon } from "@/components/brand-icons";
import { BackLink } from "@/components/projects/back-link";
import { RepoPicker } from "@/components/projects/repo-picker";
import { StepHeader } from "@/components/projects/step-header";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import { installationSettingsUrl } from "@/lib/github/app";
import { listInstallationRepos, type InstallationRepo } from "@/lib/github/repos";

// 온보딩 2단계 — GitHub 레포 고르기.
//
// 설치가 없으면 설치로 보내고, 있으면 그 설치들이 열어준 레포를 모아서 보여준다.
export default async function GitHubConnectPage({
  searchParams,
}: PageProps<"/projects/new/github">) {
  const user = await requireUser();

  // searchParams 값은 같은 키가 여러 번 오면 배열이 된다. 첫 값만 쓴다.
  const params = await searchParams;
  const error = first(params.error);
  const notice = first(params.notice);

  // 지워진 설치(deletedAt)는 뺀다. 행은 남겨두지만 — 프로젝트가 참조를 잃으면
  // 통째로 사라진다(onDelete: Cascade) — GitHub 에 물어보면 404 라서, 남겨두면
  // 재설치하고 돌아온 사용자에게 "일부 설치의 레포를 못 읽었다" 빨간 배너가 뜬다.
  const installations = await prisma.githubInstallation.findMany({
    where: { userId: user.id, suspendedAt: null, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  // 이미 프로젝트로 만든 레포는 다시 고를 수 없게 표시한다.
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    select: { ref: true, repoId: true },
  });
  const refByRepoId = new Map(projects.map((p) => [p.repoId.toString(), p.ref]));

  // 설치별로 GitHub 에 물어본다. 하나가 실패해도(설치 취소·권한 변경) 나머지는 보여준다.
  const results = await Promise.allSettled(
    installations.map((installation) => listInstallationRepos(Number(installation.id)))
  );

  const repos: InstallationRepo[] = [];
  const installationIdByRepoId = new Map<number, bigint>();

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    for (const repo of result.value) {
      repos.push(repo);
      installationIdByRepoId.set(repo.id, installations[index].id);
    }
  });

  const failed = results.some((r) => r.status === "rejected");

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
            settingsUrl={installationSettingsUrl(installations[0])}
          />
        )}
      </div>
    </>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
