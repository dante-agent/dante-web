import Link from "next/link";
import { ArrowLeft, GitBranch, Lock } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { buttonVariants } from "@/components/ui/button";

// 온보딩 1단계 — 어디에서 코드를 가져올지 고른다.
//
// 레이아웃은 Supabase 대시보드의 Settings → Integrations 를 그대로 따랐다.
//   [56px 타일] 제목(18/600) + 설명(13, muted)
//   그 아래 별도 패널(border, radius 8)에 라벨 + 액션 버튼
//
// 지원하지 않는 제공자를 숨기지 않고 남겨두는 이유도 같은 화면에서 가져왔다
// (Supabase 는 AWS PrivateLink 를 "Available on Team and Enterprise plans" 로 보여준다).
// "없는 것"과 "아직인 것"을 구분해줘야 사용자가 헤매지 않는다.
export default function NewProjectPage() {
  return (
    <>
      <Link
        href="/projects"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "text-muted-foreground -ml-2.5",
        })}
      >
        <ArrowLeft />
        프로젝트
      </Link>

      <h1 className="font-heading mt-3 text-[22px] leading-tight font-semibold tracking-tight">
        프로젝트 연결
      </h1>
      <p className="text-muted-foreground mt-1.5 text-[15px]">
        테스트를 만들 코드가 어디에 있나요? 레포 하나가 프로젝트 하나입니다.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section>
          <ProviderHeading
            icon={<GitHubIcon className="size-6" />}
            name="GitHub"
            description="연결할 레포를 직접 고릅니다. Dante 는 고른 레포만 읽습니다."
          />
          <Panel>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">GitHub 레포</p>
              <p className="text-muted-foreground mt-0.5 text-[13px]">
                레포를 연결해 테스트 생성을 시작합니다
              </p>
            </div>
            <Link
              href="/projects/new/github"
              className={buttonVariants({ size: "sm", className: "shrink-0" })}
            >
              <GitHubIcon />
              GitHub 연결
            </Link>
          </Panel>
        </section>

        <UnsupportedProvider name="GitLab" description="GitLab 레포에서 테스트를 만듭니다." />
        <UnsupportedProvider name="Bitbucket" description="Bitbucket 레포에서 테스트를 만듭니다." />
      </div>
    </>
  );
}

function ProviderHeading({
  icon,
  name,
  description,
  muted,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      {/* 56px 정사각 타일 — Supabase 통합 목록과 같은 치수 */}
      <div
        className={`border-border bg-card flex size-14 shrink-0 items-center justify-center rounded-lg border ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {icon}
      </div>
      {/* 설명 컬럼은 패널(688)보다 좁다 — Supabase 실측 488px */}
      <div className="max-w-[488px] min-w-0 pt-1">
        <h2 className="font-heading text-lg leading-tight font-semibold">{name}</h2>
        <p className="text-muted-foreground mt-1 text-[13px]">{description}</p>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-card mt-4 flex items-center justify-between gap-4 rounded-lg border px-5 py-4">
      {children}
    </div>
  );
}

function UnsupportedProvider({ name, description }: { name: string; description: string }) {
  return (
    <section>
      <ProviderHeading
        icon={<GitBranch className="size-6" />}
        name={name}
        description={description}
        muted
      />
      <Panel>
        <div className="text-muted-foreground flex items-center gap-2.5 text-[13px]">
          <Lock className="size-3.5 shrink-0" />
          아직 지원하지 않습니다. GitHub 부터 지원합니다.
        </div>
      </Panel>
    </section>
  );
}
