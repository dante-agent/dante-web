import { format } from "date-fns";
import { notFound } from "next/navigation";
import { FlaskConical, GitBranch, Clock, FileCode2 } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { getMonthlyProjectAiUsage } from "@/lib/ai/usage-queries";
import { requireUser } from "@/lib/auth/user";
import type { ConnectionStatus } from "@/lib/github/connection";
import { getDashboardProject, getOwnedProjectId } from "@/lib/projects/queries";
import { AdvisorSection } from "./_components/advisor-section";
import { AiUsageSection } from "./_components/ai-usage-section";
import { CopyButton } from "./_components/copy-button";
import { GetStarted } from "./_components/get-started";
import { HeroStat, StatusDots } from "./_components/hero-stat";
import { ReportsSection } from "./_components/reports-section";
import { Section } from "./_components/section";
import { SuitePanel } from "./_components/suite-panel";
import { UsageSection } from "./_components/usage-section";
import { dashboardMock } from "./mock-data";

/**
 * 상태 한 단어. 자세한 안내(무엇을 눌러야 하는지)는 연결 배너가 따로 한다 —
 * 여기는 칸이 한 줄이라 사유만 적는다.
 */
const STATUS_LABEL: Record<ConnectionStatus, string> = {
  ok: "Healthy",
  suspended: "Suspended",
  app_removed: "App removed",
  repo_removed: "Repo removed",
  repo_deleted: "Repo deleted",
};

/** "Sep 12, 6:32pm" — Supabase 프로젝트 홈과 같은 형식. */
function stamp(iso: string) {
  return format(new Date(iso), "MMM d, h:mmaaa");
}

export default async function DashboardPage({
  params,
}: PageProps<"/project/[projectRef]/dashboard">) {
  const { projectRef } = await params;
  const user = await requireUser();
  // 사용량은 내부 id 로 집계한다. DashboardProject 에는 id 가 없어서
  // (ref 만 화면으로 내보내는 게 그 타입의 뜻이다) 한 번 더 읽는다 —
  // getOwnedProjectId 는 cache 라 같은 요청 안에서는 왕복이 한 번이다.
  const [project, projectId] = await Promise.all([
    getDashboardProject(projectRef, user.id),
    getOwnedProjectId(projectRef, user.id),
  ]);
  // 레이아웃이 이미 소유를 확인했으므로 여기서 없을 일은 사실상 없다.
  // 그래도 타입을 좁혀야 하고, 사이에 레포가 지워졌다면 404 가 맞는 답이다.
  if (!project || !projectId) notFound();

  const aiUsage = await getMonthlyProjectAiUsage(projectId);

  const { suite, usage, advisories } = dashboardMock;
  const repoPath = `${project.repoOwner}/${project.repoName}`;

  // p-8: 프로젝트 셸의 <main> 이 여백을 더 이상 주지 않는다 (폴더 보기가 화면을 꽉 써야 해서)
  return (
    <div className="flex flex-col gap-12 p-8">
      {/* 히어로 — 좌: 프로젝트 사실들, 우: 테스트 스위트 패널 */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-8">
          <div>
            <h1 className="font-heading text-3xl tracking-tight">{project.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-sm">github.com/{repoPath}</span>
              <CopyButton value={`https://github.com/${repoPath}`} />
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            <HeroStat icon={<StatusDots ok={project.connection === "ok"} />} label="Status">
              {STATUS_LABEL[project.connection]}
            </HeroStat>

            <HeroStat icon={<FlaskConical strokeWidth={1.5} />} label="Framework">
              {project.testFramework ? (
                <span className="border-border rounded-4xl border px-2 py-0.5 font-mono text-[11px] tracking-[0.1em] uppercase">
                  {project.testFramework}
                </span>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </HeroStat>

            <HeroStat icon={<GitHubIcon />} label="GitHub">
              {repoPath}
            </HeroStat>

            <HeroStat icon={<GitBranch strokeWidth={1.5} />} label="Default branch">
              {project.defaultBranch}
            </HeroStat>

            <HeroStat icon={<Clock strokeWidth={1.5} />} label="Last run">
              {stamp(suite.lastRunAt)}
            </HeroStat>

            <HeroStat icon={<FileCode2 strokeWidth={1.5} />} label="Last generated">
              {stamp(suite.lastGeneratedAt)}
            </HeroStat>
          </div>
        </div>

        <SuitePanel
          framework={project.testFramework ?? "No framework set"}
          branch={project.defaultBranch}
          testFiles={suite.testFiles}
          components={suite.components}
          runs={usage.series[0].total}
          passRate={suite.passRate}
        />
      </div>

      <Section title="Get started">
        <GetStarted projectRef={projectRef} />
      </Section>

      <UsageSection
        series={usage.series}
        from={usage.from}
        to={usage.to}
        passRate={suite.passRate}
      />

      <AiUsageSection usage={aiUsage} />

      <AdvisorSection advisories={advisories} projectRef={projectRef} />

      <ReportsSection />
    </div>
  );
}
