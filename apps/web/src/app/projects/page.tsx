import Link from "next/link";
import { GitBranch, Plus } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { mockProjects } from "@/lib/mock-data";

// 로그인 후 착륙 지점. 프로젝트가 0개여도 /projects/new 로 자동 리다이렉트하지 않는다
// — 뒤로가기를 누르면 다시 튕겨 나와 루프가 생긴다. 대신 빈 상태를 보여주고 CTA 를 둔다.
//
// TODO(다음 PR): mockProjects → 로그인 사용자가 속한 팀의 Project 조회로 교체.
export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  // ?state=empty — 목업 단계에서 빈 상태를 눈으로 확인하려는 임시 스위치. DB 붙으면 삭제.
  const { state } = await searchParams;
  const projects = state === "empty" ? [] : mockProjects;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">프로젝트</h1>
        {projects.length > 0 && (
          <Link href="/projects/new" className={buttonVariants({ size: "lg" })}>
            <Plus />새 프로젝트
          </Link>
        )}
      </div>

      {projects.length === 0 ? <EmptyState /> : <ProjectGrid projects={projects} />}
    </>
  );
}

function ProjectGrid({ projects }: { projects: typeof mockProjects }) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {projects.map((project) => (
        <li key={project.ref}>
          {/* 카드 전체가 링크. block 이라 카드 어디를 눌러도 들어간다. */}
          <Link
            href={`/project/${project.ref}/dashboard`}
            className="border-border bg-card hover:border-input block rounded-xl border p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{project.name}</p>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate font-mono text-xs">
                  <GitHubIcon className="size-3 shrink-0" />
                  {project.repoFullName}
                </p>
              </div>
              <PassRateBadge value={project.passRate} />
            </div>

            <div className="text-muted-foreground mt-4 flex items-center gap-4 font-mono text-xs">
              <span className="flex items-center gap-1">
                <GitBranch className="size-3" />
                {project.defaultBranch}
              </span>
              <span>테스트 {project.testCount}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 통과율은 브랜드 3색을 상태 신호로 쓴다 (DESIGN.md §1: Mint = 통과).
// 아직 한 번도 안 돌린 프로젝트는 0% 가 아니라 "미실행" — 0% 로 보이면 다 실패한 걸로 읽힌다.
function PassRateBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground shrink-0">
        미실행
      </Badge>
    );
  }

  const isHealthy = value >= 0.9;
  return (
    <Badge
      variant="outline"
      className={`shrink-0 font-mono ${
        isHealthy ? "border-brand-mint/30 text-brand-mint" : "border-primary/30 text-primary"
      }`}
    >
      {Math.round(value * 100)}%
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="border-border mt-8 flex flex-col items-center rounded-xl border border-dashed px-6 py-20 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <GitHubIcon className="size-5" />
      </div>
      <h2 className="font-heading mt-5 text-lg font-semibold">아직 프로젝트가 없습니다</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-balance">
        GitHub 레포를 연결하면 Dante 가 코드를 읽고 빠진 테스트를 찾아냅니다.
      </p>
      <Link href="/projects/new" className={buttonVariants({ size: "lg", className: "mt-6" })}>
        <GitHubIcon />
        GitHub 레포 연결하기
      </Link>
    </div>
  );
}
