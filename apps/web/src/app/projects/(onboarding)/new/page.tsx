import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { StepHeader } from "@/components/projects/step-header";
import { buttonVariants } from "@/components/ui/button";

// 온보딩 1단계 — 어디에서 코드를 가져올지 고른다.
//
// 각진 패널(radius 0) · 헤어라인 · 색 전환 180ms 는 CodeRabbit 실측 기준.
// 지원 예정 제공자는 흐린 죽은 카드가 아니라 SOON 뱃지로 상태를 말해준다.
export default function NewProjectPage() {
  return (
    <>
      <StepHeader
        title="어디에 코드가 있나요"
        description="레포 하나가 프로젝트 하나입니다. 연결하면 Dante 가 코드를 읽고 빠진 테스트를 찾아냅니다."
      />

      <div className="mt-8 flex flex-col gap-3">
        {/* 패널 전체가 링크 — 누를 곳이 넓고 hover 가 한 덩어리로 움직인다. */}
        <Link
          href="/projects/new/github"
          className="group border-border bg-card hover:border-input block border p-6 transition-colors duration-[180ms] ease-out"
        >
          <div className="flex items-center gap-4">
            <GitHubIcon className="size-6 shrink-0" />
            <span className="font-heading flex-1 text-lg leading-tight font-medium">GitHub</span>
            <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </div>
          <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
            설치할 때 열어줄 레포를 직접 고릅니다. 고른 레포 밖은 보지 않습니다.
          </p>
          {/* 정보와 메타를 가르는 헤어라인 — CodeRabbit 카드의 구조 */}
          <div className="border-border group-hover:border-input mt-5 border-t pt-3 transition-colors duration-[180ms] ease-out">
            <p className="text-muted-foreground font-mono text-[10px] tracking-wide">
              CONTENTS · PULL REQUESTS · METADATA
            </p>
          </div>
        </Link>

        <ComingSoon name="GitLab" />
        <ComingSoon name="Bitbucket" />
      </div>

      <p className="text-muted-foreground mt-8 text-[13px]">
        이미 만든 프로젝트를 찾으시나요?{" "}
        <Link
          href="/projects"
          className={buttonVariants({
            variant: "link",
            size: "sm",
            className: "h-auto p-0 text-[13px]",
          })}
        >
          프로젝트 목록
        </Link>
      </p>
    </>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="border-border/60 flex items-center gap-4 border border-dashed px-6 py-4">
      <Lock className="text-muted-foreground/60 size-4 shrink-0" />
      <span className="text-muted-foreground font-heading flex-1 text-lg font-medium">{name}</span>
      <span className="text-muted-foreground/70 border-border shrink-0 border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em]">
        SOON
      </span>
    </div>
  );
}
