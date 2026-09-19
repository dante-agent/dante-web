import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@dante/db";
import { ConnectionPanel } from "@/components/settings/github/connection-panel";
import { SettingsHeader } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { installationSettingsUrl } from "@/lib/github/app";
import { connectionNotice, projectConnection } from "@/lib/github/connection";

export const metadata: Metadata = { title: "GitHub settings" };

// 깃허브 연결. 읽기 + 복구 전용이다.
//
// 하는 일은 둘뿐이다: 지금 붙어 있나를 보여주고, 끊겼으면 GitHub 의 어느 화면으로
// 가야 풀리는지 알려준다. 바꾸는 일은 전부 다른 곳에 있다 — 레포 변경은 상단
// 프로젝트 헤더, 프로젝트 삭제는 General 하단, 브랜치·PR 정책은 Runtime.
// 여기에 모아두면 "연결이 왜 끊겼지"를 보러 온 사용자가 실행 설정 사이에서
// 답을 찾아야 한다.
export default async function ProjectGithubPage({
  params,
}: PageProps<"/project/[projectRef]/settings/github">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 레이아웃에서 이미 소유를 확인했지만 페이지도 멤버십으로 다시 거른다 —
  // 레이아웃이 바뀌면 조용히 뚫린다 (General 페이지와 같은 이유).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: {
      repoId: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      isPrivate: true,
      disconnectedAt: true,
      disconnectedReason: true,
      installation: {
        select: {
          id: true,
          accountLogin: true,
          accountType: true,
          createdAt: true,
          suspendedAt: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!project) notFound();

  const { installation } = project;
  const status = projectConnection(project);
  const notice = connectionNotice(status, {
    accountLogin: installation.accountLogin,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    installationSettingsUrl: installationSettingsUrl(installation),
    projectRef,
  });

  // 끊긴 상태에서도 값은 계속 보여준다. 숨기면 "무엇이 끊겼는지"를 읽을 수 없다.
  // 끊겼다는 표시는 위 ConnectionPanel 문구가 맡는다 — 카드를 흐리게(opacity-60) 하면
  // 값 글자 대비가 AA 아래로 떨어진다.

  return (
    <>
      <SettingsHeader
        title="GitHub"
        description="The repository this project reads, and the App installation that grants access to it."
      />

      <ConnectionPanel notice={notice} projectRef={projectRef} />

      <div className="mt-8 max-w-2xl">
        <SectionLabel>Installation</SectionLabel>

        <Card>
          <dl className="divide-border divide-y">
            <Field label="Account">
              <span className="flex items-center gap-2">
                @{installation.accountLogin}
                <Badge variant="outline" className="font-sans">
                  {installation.accountType}
                </Badge>
              </span>
            </Field>
            {/* GitHub 지원에 문의할 때 이 값을 묻는다. mono 로 두면 자릿수를 세고
                옮겨 적기 쉽다. BigInt 는 서버 → 클라이언트 경계를 못 넘으므로
                렌더 전에 문자열로 바꾼다. */}
            <Field label="Installation ID">{String(installation.id)}</Field>
            <Field label="Connected">
              {formatDistanceToNow(installation.createdAt, { addSuffix: true })}
            </Field>
          </dl>

          <div className="border-border border-t px-5 py-3">
            <a
              href={installationSettingsUrl(installation)}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground hover:text-foreground font-mono text-[11px] tracking-wide transition-colors duration-[180ms] ease-out"
            >
              MANAGE ON GITHUB ↗
            </a>
          </div>
        </Card>

        <div className="mt-8">
          <SectionLabel>Repository</SectionLabel>
        </div>

        <Card>
          <dl className="divide-border divide-y">
            <Field label="Repository">
              <span className="flex items-center gap-2">
                {/* owner/name 은 표시용 캐시고 웹훅이 갱신한다(schema.prisma).
                    사용자에게는 그냥 "지금 이름"이라 UI 에 드러내지 않는다. */}
                <a
                  href={`https://github.com/${project.repoOwner}/${project.repoName}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-foreground underline underline-offset-4"
                >
                  {project.repoOwner}/{project.repoName}
                </a>
                {project.isPrivate && (
                  <Badge variant="outline" className="font-sans">
                    Private
                  </Badge>
                )}
              </span>
            </Field>
            <Field label="Default branch">{project.defaultBranch}</Field>
            <Field label="Repo ID">{String(project.repoId)}</Field>
          </dl>
        </Card>
      </div>
    </>
  );
}

/** 카드 위의 작은 라벨. 설정 셸의 스코프 라벨과 같은 모양이다. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
      {children}
    </h2>
  );
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`border-border bg-card mt-3 border ${className}`}>{children}</div>;
}

/** General 페이지의 필드 줄과 같은 모양. 값에 뱃지·링크가 들어와서 ReactNode 다. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 px-5 py-4">
      <dt className="text-muted-foreground w-32 shrink-0 text-[13px]">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">{children}</dd>
    </div>
  );
}
