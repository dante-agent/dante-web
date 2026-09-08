import Link from "next/link";
import { ArrowLeft, GitBranch, Lock } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { buttonVariants } from "@/components/ui/button";

// 온보딩 1단계 — 어디에서 코드를 가져올지 고른다.
//
// 지금은 GitHub 만 지원한다. 나머지를 아예 숨기지 않고 비활성으로 보여주는 이유는
// "없는 것"과 "아직인 것"을 구분해주기 위해서다 — 사용자가 GitLab 을 찾다가
// 이 제품이 안 되는 건지 헷갈리지 않게.
export default function NewProjectPage() {
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

      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">프로젝트 연결</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        테스트를 만들 코드가 어디에 있나요? 레포 하나가 프로젝트 하나입니다.
      </p>

      <div className="mt-8 grid gap-3">
        <Link
          href="/projects/new/github"
          className="border-border bg-card hover:border-input flex items-center gap-4 rounded-xl border p-4 transition-colors"
        >
          <GitHubIcon className="size-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">GitHub 연결</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              연결할 레포를 직접 고릅니다. 고른 레포만 읽습니다.
            </p>
          </div>
        </Link>

        <ProviderPlaceholder name="GitLab" />
        <ProviderPlaceholder name="Bitbucket" />
      </div>
    </div>
  );
}

function ProviderPlaceholder({ name }: { name: string }) {
  return (
    // 링크가 아니라 div — 누를 수 없다는 걸 커서·색으로도 알 수 있게 한다.
    <div
      aria-disabled="true"
      className="border-border flex items-center gap-4 rounded-xl border border-dashed p-4 opacity-50"
    >
      <GitBranch className="text-muted-foreground size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          {name}
          <Lock className="text-muted-foreground size-3" />
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">아직 지원하지 않습니다</p>
      </div>
    </div>
  );
}
