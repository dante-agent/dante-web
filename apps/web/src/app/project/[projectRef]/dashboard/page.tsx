import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMonthlyBudgetStatus } from "@/lib/ai/budget";
import {
  getMonthlyProjectAiUsage,
  getMonthlyProjectAiUsageBySurface,
} from "@/lib/ai/usage-queries";
import { requireUser } from "@/lib/auth/user";
import { getRecentPullRequests, getRecentRuns } from "@/lib/projects/dashboard-queries";
import { getDashboardProject, getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { AiSpendSection } from "./_components/ai-spend-section";
import { CoverageSection, CoverageSkeleton } from "./_components/coverage-section";
import { ProjectHeader } from "./_components/project-header";
import { PullRequestsSection } from "./_components/pull-requests-section";
import { RecentRunsSection } from "./_components/recent-runs-section";
import { UpNextSection, UpNextSkeleton } from "./_components/up-next-section";

export const metadata: Metadata = { title: "Dashboard" };

// 프로젝트 대시보드. 위에서부터 프로젝트 한 줄 → 커버리지 → 최근 실행 | 다음에 할 것 → AI 지출 | PR.
//
// DB 에서 오는 섹션(최근 실행·AI 지출·PR)은 페이지와 함께 그린다. GitHub 트리를 기다리는
// 섹션(커버리지·다음에 할 것)만 Suspense 로 감싸 뼈대를 먼저 보낸다 — 둘은 같은 요청 캐시로
// GitHub 을 한 번만 부른다(lib/github/tree.ts).
export default async function DashboardPage({
  params,
}: PageProps<"/project/[projectRef]/dashboard">) {
  const { projectRef } = await params;
  const user = await requireUser();
  // 지표는 내부 id 로 집계한다. DashboardProject 에는 id 가 없어서
  // (ref 만 화면으로 내보내는 게 그 타입의 뜻이다) 한 번 더 읽는다 —
  // getOwnedProjectId 는 cache 라 같은 요청 안에서는 왕복이 한 번이다.
  const [project, projectId] = await Promise.all([
    getDashboardProject(projectRef, user.id),
    getOwnedProjectId(projectRef, user.id),
  ]);
  // 레이아웃이 이미 소유를 확인했으므로 여기서 없을 일은 사실상 없다.
  // 그래도 타입을 좁혀야 하고, 사이에 레포가 지워졌다면 404 가 맞는 답이다.
  if (!project || !projectId) notFound();

  // GitHub 트리는 연결이 정상일 때만 읽는다 — 앱이 지워졌거나 정지되면 설치 토큰 호출이 실패한다.
  const repo = project.connection === "ok" ? await getProjectRepo(projectRef, user.id) : null;

  const [runs, pulls, usage, bySurface, budget] = await Promise.all([
    getRecentRuns(projectId),
    getRecentPullRequests(projectId),
    getMonthlyProjectAiUsage(projectId),
    getMonthlyProjectAiUsageBySurface(projectId),
    // 한도는 사람마다(모든 프로젝트 합계) 걸린다. 이 프로젝트 금액과 섞지 않고 따로 적는다.
    getMonthlyBudgetStatus(user.id),
  ]);

  // p-8: 프로젝트 셸의 <main> 이 여백을 주지 않는다 (폴더 보기가 화면을 꽉 써야 해서)
  return (
    <div className="flex flex-col gap-11 p-8">
      <ProjectHeader project={project} />

      {repo && (
        <Suspense fallback={<CoverageSkeleton />}>
          <CoverageSection repo={repo} projectId={projectId} />
        </Suspense>
      )}

      {/* 둘 다 "파일 목록"이라 넓은 화면에서는 나란히, 좁으면 위아래로 쌓는다. */}
      <div className="grid gap-11 lg:grid-cols-2 lg:gap-6">
        <RecentRunsSection projectRef={projectRef} runs={runs} />
        {repo && (
          <Suspense fallback={<UpNextSkeleton projectRef={projectRef} />}>
            <UpNextSection projectRef={projectRef} repo={repo} projectId={projectId} />
          </Suspense>
        )}
      </div>

      {/* 보조 정보 둘. 위의 두 목록과 같은 격자라 전체 폭 → 두 칸 → 두 칸으로 리듬이 일정하다. */}
      <div className="grid gap-11 lg:grid-cols-2 lg:gap-6">
        <AiSpendSection usage={usage} bySurface={bySurface} budget={budget} />
        <PullRequestsSection projectRef={projectRef} pulls={pulls} />
      </div>
    </div>
  );
}
