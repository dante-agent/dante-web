import Link from "next/link";
import { ArrowRight, GitBranch, Plus } from "lucide-react";
import { prisma } from "@dante/db";
import { GitHubIcon } from "@/components/brand-icons";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";

// 로그인 후 착륙 지점.
//
// 프로젝트가 0개여도 /projects/new 로 자동 리다이렉트하지 않는다 — 뒤로가기를
// 누르면 다시 튕겨 나와 루프가 생긴다. 대신 빈 상태를 보여주고 CTA 를 둔다.
//
// 분할 셸의 왼쪽 컬럼(~450px)에 들어가므로 카드가 아니라 세로 목록이다.
export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      ref: true,
      name: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      setupCompletedAt: true,
    },
  });

  if (projects.length === 0) return <EmptyState />;

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-heading text-[26px] leading-[1.2] font-medium tracking-[-0.02em]">
          Projects
        </h1>
        <Link
          href="/projects/new"
          className={buttonVariants({ size: "sm", className: "rounded-[4px]" })}
        >
          <Plus />
          New project
        </Link>
      </div>

      <ul className="border-border divide-border bg-card mt-6 divide-y border">
        {projects.map((project) => (
          <li key={project.ref}>
            {/* 설정을 안 끝낸 프로젝트는 대시보드가 아니라 이어서 할 곳으로 보낸다. */}
            <Link
              href={
                project.setupCompletedAt
                  ? `/project/${project.ref}/dashboard`
                  : `/projects/setup/${project.ref}/framework`
              }
              className="group hover:bg-muted/30 block px-5 py-4 transition-colors duration-[180ms] ease-out"
            >
              <div className="flex items-center gap-3">
                <GitHubIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="flex-1 truncate text-[15px] font-medium">{project.name}</span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </div>

              <p className="text-muted-foreground mt-1.5 flex items-center gap-3 pl-7 font-mono text-[11px] tracking-wide">
                <span className="truncate">
                  {project.repoOwner}/{project.repoName}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <GitBranch className="size-3" />
                  {project.defaultBranch}
                </span>
              </p>

              {!project.setupCompletedAt && (
                <p className="mt-2 pl-7 font-mono text-[10px] font-bold tracking-[0.12em] text-[#ff801f]">
                  Finish setup
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// 프로젝트가 없을 때는 목록이 아니라 사실상 온보딩 진입점이다.
// 그래서 제목도 "프로젝트"가 아니라 지금 할 일로 쓴다.
function EmptyState() {
  return (
    <>
      {/* 이미 가입하고 들어온 사람에게 제품을 다시 설명하지 않는다.
          지금 상태를 말하고, 이 빈 목록이 무엇으로 채워지는지만 알려준다. */}
      <h1 className="font-heading text-[26px] leading-[1.2] font-medium tracking-[-0.02em]">
        No repositories connected
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        Repositories you connect appear here as projects
      </p>

      {/* 이 화면의 단 하나뿐인 행동이라 로그인 버튼(h-10)보다 한 단계 크게 잡는다. */}
      <Link
        href="/projects/new"
        className={buttonVariants({
          size: "lg",
          className: "group mt-8 h-12 w-full gap-2.5 rounded-[4px] text-[15px]",
        })}
      >
        <GitHubIcon className="size-4.5" />
        Connect GitHub
        <ArrowRight className="size-4.5 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </>
  );
}
