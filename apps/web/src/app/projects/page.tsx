import Link from "next/link";
import { GitBranch, Plus } from "lucide-react";
import { prisma } from "@dante/db";
import { GitHubIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";

// 로그인 후 착륙 지점.
//
// 프로젝트가 0개여도 /projects/new 로 자동 리다이렉트하지 않는다 — 뒤로가기를
// 누르면 다시 튕겨 나와 루프가 생긴다. 대신 빈 상태를 보여주고 CTA 를 둔다.
//
// 치수는 Supabase 대시보드 조직 목록 실측값:
//   제목 22/600 · 카드 padding 12 / radius 8 · 그리드 gap 16
//   카드 제목 13/600 · 메타 12 muted · 아이콘 32px 원형
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

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-[22px] leading-tight font-semibold tracking-tight">
          프로젝트
        </h1>
        {projects.length > 0 && (
          <Link href="/projects/new" className={buttonVariants({ size: "sm" })}>
            <Plus />새 프로젝트
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.ref}>
              {/* 카드 전체가 링크 — 어디를 눌러도 들어간다 */}
              <Link
                href={`/project/${project.ref}/dashboard`}
                className="border-border bg-card hover:border-input block rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="border-border bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
                    <GitHubIcon className="size-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{project.name}</p>
                    <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
                      {project.repoOwner}/{project.repoName}
                    </p>
                    <p className="text-muted-foreground mt-2 flex items-center gap-1 font-mono text-[11px]">
                      <GitBranch className="size-3" />
                      {project.defaultBranch}
                    </p>
                  </div>

                  {/* 온보딩(러너·API 키)을 안 끝낸 프로젝트는 이어서 하도록 표시한다 */}
                  {!project.setupCompletedAt && (
                    <Badge variant="outline" className="text-muted-foreground shrink-0 text-[11px]">
                      설정 미완료
                    </Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="border-border mt-6 flex flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="border-border bg-card text-muted-foreground flex size-14 items-center justify-center rounded-lg border">
        <GitHubIcon className="size-6" />
      </div>
      <h2 className="font-heading mt-4 text-lg leading-tight font-semibold">
        아직 프로젝트가 없습니다
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-[13px] text-balance">
        GitHub 레포를 연결하면 Dante 가 코드를 읽고 빠진 테스트를 찾아냅니다.
      </p>
      <Link href="/projects/new" className={buttonVariants({ size: "sm", className: "mt-5" })}>
        <GitHubIcon />
        GitHub 레포 연결하기
      </Link>
    </div>
  );
}
