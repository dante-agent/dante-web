import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@dante/db";
import { GitHubIcon } from "@/components/brand-icons";
import { RepoPicker } from "@/components/projects/repo-picker";
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

  const installations = await prisma.githubInstallation.findMany({
    where: { userId: user.id, suspendedAt: null },
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
    <div className="mx-auto max-w-2xl">
      <Link
        href="/projects/new"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "text-muted-foreground -ml-2",
        })}
      >
        <ArrowLeft />
        프로젝트 연결
      </Link>

      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">GitHub 연결</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        테스트를 만들 레포를 고르세요. 나중에 설정에서 바꿀 수 있습니다.
      </p>

      {error && <Banner tone="error">{errorMessage(error)}</Banner>}
      {notice === "requested" && (
        <Banner tone="notice">
          조직 관리자에게 설치 승인을 요청했습니다. 승인되면 여기에서 레포가 보입니다.
        </Banner>
      )}
      {failed && !error && (
        <Banner tone="error">
          일부 설치에서 레포를 가져오지 못했습니다. GitHub 에서 연결이 유지되고 있는지 확인해
          주세요.
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
            settingsUrl={installationSettingsUrl(installations[0].id)}
          />
        )}
      </div>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(code: string) {
  switch (code) {
    case "state":
      // 대개는 공격이 아니라 오래 걸렸거나 다른 탭에서 시작한 경우다.
      return "설치 확인에 실패했습니다. 시간이 오래 지났을 수 있으니 다시 시도해 주세요.";
    case "mismatch":
      return "로그인한 GitHub 계정과 설치한 계정이 다릅니다.";
    case "account":
      return "Enterprise 계정은 아직 지원하지 않습니다.";
    default:
      return "GitHub 설치 정보를 가져오지 못했습니다. 다시 시도해 주세요.";
  }
}

function Banner({ tone, children }: { tone: "error" | "notice"; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-destructive/30 text-destructive"
          : "border-brand-cobalt/30 text-brand-cobalt"
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
    <div className="border-border bg-card flex flex-col items-center rounded-xl border px-6 py-14 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <GitHubIcon className="size-5" />
      </div>
      <h2 className="font-heading mt-5 text-lg font-semibold">GitHub 계정을 연결하세요</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-balance">
        Dante 는 선택한 레포만 읽습니다. 설치할 때 어떤 레포를 열어줄지 직접 고를 수 있고, 나중에
        GitHub 설정에서 언제든 바꾸거나 해제할 수 있습니다.
      </p>
      {/* 서버 라우트가 state 쿠키를 심고 GitHub 설치 화면으로 보낸다. */}
      <a href="/api/github/install" className={buttonVariants({ size: "lg", className: "mt-6" })}>
        <GitHubIcon />
        GitHub 연결
      </a>
    </div>
  );
}
