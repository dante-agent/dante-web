import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { StepHeader } from "@/components/projects/step-header";
import { buttonVariants } from "@/components/ui/button";

// 온보딩 1단계 — 어디에서 코드를 가져올지 고른다.
//
// 생김새는 CodeRabbit 브랜드 사이트 기준이다: 각진 패널(radius 0), 넉넉한
// 패딩(32), 정보와 액션을 가르는 헤어라인, 오렌지 모노 라벨.
// 지원 예정 제공자는 흐린 죽은 카드가 아니라 SOON 뱃지로 상태를 말해준다.
export default function NewProjectPage() {
  return (
    <>
      <Link
        href="/projects"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "text-muted-foreground mb-8 -ml-2.5",
        })}
      >
        <ArrowLeft />
        프로젝트
      </Link>

      <StepHeader
        step={1}
        label="프로젝트 연결"
        title="어디에 코드가 있나요"
        description="레포 하나가 프로젝트 하나입니다. 연결하면 Dante 가 코드를 읽고 빠진 테스트를 찾아냅니다."
      />

      <div className="mt-12 flex flex-col gap-4">
        <Panel>
          <div className="flex items-start gap-5">
            <GitHubIcon className="mt-0.5 size-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-2xl leading-tight font-medium tracking-[-0.01em]">
                GitHub
              </h2>
              <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                설치할 때 열어줄 레포를 직접 고릅니다. 고른 레포 밖은 보지 않습니다.
              </p>
            </div>
            <Link
              href="/projects/new/github"
              className={buttonVariants({ size: "lg", className: "shrink-0 rounded-[4px]" })}
            >
              연결
              <ArrowRight />
            </Link>
          </div>

          {/* 정보와 메타를 가르는 헤어라인 — CodeRabbit 카드의 구조 */}
          <div className="border-border mt-6 border-t pt-4">
            <p className="text-muted-foreground font-mono text-[11px] tracking-wide">
              CONTENTS · PULL REQUESTS · METADATA 권한만 요청합니다
            </p>
          </div>
        </Panel>

        <ComingSoon name="GitLab" />
        <ComingSoon name="Bitbucket" />
      </div>
    </>
  );
}

// radius 0 · border 1 · padding 32 — CodeRabbit 카드 실측값
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border-border bg-card border p-8">{children}</div>;
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="border-border/60 flex items-center gap-5 border border-dashed px-8 py-5">
      <span className="text-muted-foreground font-heading text-lg font-medium">{name}</span>
      <span className="text-muted-foreground/70 border-border ml-auto border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em]">
        SOON
      </span>
    </div>
  );
}
