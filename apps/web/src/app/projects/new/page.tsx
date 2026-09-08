import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { StepHeader } from "@/components/projects/step-header";
import { buttonVariants } from "@/components/ui/button";

// 온보딩 1단계 — 어디에서 코드를 가져올지 고른다.
//
// 생김새·모션 모두 coderabbit.ai 실측 기준이다: 각진 패널(radius 0), 넉넉한
// 패딩(32), 정보와 액션을 가르는 헤어라인, 색 전환 180ms.
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
        title="어디에 코드가 있나요"
        description="레포 하나가 프로젝트 하나입니다. 연결하면 Dante 가 코드를 읽고 빠진 테스트를 찾아냅니다."
      />

      <div className="mt-12 flex flex-col gap-4">
        {/* 패널 전체가 링크 — 누를 곳이 넓고, hover 가 한 덩어리로 움직인다.
            안에 또 다른 버튼을 두지 않으려고 "연결"은 버튼처럼 보이는 span 이다. */}
        <Link
          href="/projects/new/github"
          className="group border-border bg-card hover:border-input block border p-8 transition-colors duration-[180ms] ease-out"
        >
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
            <span
              className={buttonVariants({
                size: "lg",
                className: "pointer-events-none shrink-0 rounded-[4px]",
              })}
            >
              연결
              {/* 화살표만 살짝 밀린다 — 방향을 알려주는 정도로 절제 */}
              <ArrowRight className="transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          </div>

          {/* 정보와 메타를 가르는 헤어라인 — CodeRabbit 카드의 구조 */}
          <div className="border-border group-hover:border-input mt-6 border-t pt-4 transition-colors duration-[180ms] ease-out">
            <p className="text-muted-foreground font-mono text-[11px] tracking-wide">
              CONTENTS · PULL REQUESTS · METADATA 권한만 요청합니다
            </p>
          </div>
        </Link>

        <ComingSoon name="GitLab" />
        <ComingSoon name="Bitbucket" />
      </div>
    </>
  );
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
