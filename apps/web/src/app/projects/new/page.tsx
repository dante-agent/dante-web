import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { RepoPicker } from "@/components/projects/repo-picker";
import { mockOwners, mockRepos } from "@/lib/mock-data";

// 프로젝트 생성. 단계를 라우트로 쪼개지 않고 한 페이지 안에서 상태만 바꾼다
// — 뒤로가기·새로고침 처리가 훨씬 단순하고, 중간에 끊긴 URL 이 생기지 않는다.
//
//   1. 미연결  → GitHub App 설치로 보낸다
//   2. 연결됨  → 레포 목록에서 Import
//
// TODO(다음 PR): GitHub App 설치 여부를 GithubInstallation 조회로 판단하고,
// 레포 목록을 Octokit `GET /installation/repositories` 로 가져온다(서버에서 페이지네이션).
export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  // ?state=disconnected — 목업 단계에서 미연결 화면을 보기 위한 임시 스위치. 연동 시 삭제.
  const { state } = await searchParams;
  const isConnected = state !== "disconnected";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/projects"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "text-muted-foreground -ml-2",
        })}
      >
        <ArrowLeft />
        프로젝트
      </Link>

      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">새 프로젝트</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        테스트를 만들 GitHub 레포를 고르세요. 레포 하나가 프로젝트 하나입니다.
      </p>

      <div className="mt-8">
        {isConnected ? <RepoPicker repos={mockRepos} owners={mockOwners} /> : <ConnectPrompt />}
      </div>
    </div>
  );
}

// 1단계. GitHub App 설치 화면으로 보낸다.
// OAuth 가 아니라 App 설치인 이유: 사용자가 "이 레포만" 을 고를 수 있고,
// 우리는 사용자 토큰을 저장하지 않아도 된다 (설치 토큰을 서버에서 1시간짜리로 발급).
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
      {/* TODO(다음 PR): href → github.com/apps/<app>/installations/new?state=<csrf> */}
      <Button size="lg" className="mt-6" disabled>
        <GitHubIcon />
        GitHub 연결
      </Button>
      <p className="text-muted-foreground mt-3 font-mono text-xs">GitHub App 연동 PR 에서 활성화</p>
    </div>
  );
}
