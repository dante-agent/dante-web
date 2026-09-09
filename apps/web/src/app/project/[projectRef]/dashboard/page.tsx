import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowRight, GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiUsageChart } from "./_components/ai-usage-chart";
import { CommitHeatmap } from "./_components/commit-heatmap";
import { FolderRatioCard } from "./_components/folder-ratio-card";
import { StatCard } from "./_components/stat-card";
import { StatusStrip } from "./_components/status-strip";
import { PersonalBadge, TeamAvatars } from "./_components/team-avatars";
import { dashboardMock, type PullRequestSummary } from "./mock-data";

const PR_STATUS_LABEL: Record<PullRequestSummary["status"], string> = {
  open: "열림",
  merged: "병합됨",
  closed: "닫힘",
};

const PR_STATUS_VARIANT: Record<PullRequestSummary["status"], "info" | "success" | "destructive"> =
  {
    open: "info",
    merged: "success",
    closed: "destructive",
  };

export default async function DashboardPage({
  params,
}: PageProps<"/project/[projectRef]/dashboard">) {
  const { projectRef } = await params;
  const { project, team, tests, ai, folderTestRatio, aiModelUsage, commitHeatmap, pullRequests } =
    dashboardMock;

  return (
    <div className="flex flex-col gap-6">
      {/* 프로젝트 정보 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight underline decoration-1 underline-offset-4">
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            프로젝트 <code className="font-mono">{projectRef}</code> · created{" "}
            {format(new Date(project.createdAt), "yyyy.MM.dd", { locale: ko })} · updated{" "}
            {format(new Date(project.updatedAt), "yyyy.MM.dd", { locale: ko })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {team.type === "team" ? <TeamAvatars members={team.members} /> : <PersonalBadge />}
          <Button variant="outline" size="sm">
            프로젝트 상세 페이지
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      {/* 실행 상태 · AI 엔진/모델 · 현재 작업 · 토큰 사용량 */}
      <StatusStrip
        running={ai.running}
        aiModel={ai.model}
        currentTask={ai.currentTask}
        tokensUsed={ai.tokensUsed}
        tokenLimit={ai.tokenLimit}
      />

      {/* 테스트 요약 지표 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="테스트 항목" value={`${tests.totalCases}개`} />
        <StatCard
          label="테스트 빌드 종류"
          value={tests.buildTypes.join(" · ")}
          hint={`${tests.buildTypes.length}개 플랫폼 실행 중`}
        />
        <StatCard
          label="성공 / 실패"
          value={
            <span>
              <span className="text-brand-mint">{tests.passed}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-brand-orange">{tests.failed}</span>
            </span>
          }
          hint={`실패 ${tests.failed}건`}
        />
        <StatCard
          label="최근 테스트"
          value={format(new Date(tests.lastRunAt), "MM.dd HH:mm", { locale: ko })}
          hint={formatDistanceToNow(new Date(tests.lastRunAt), { addSuffix: true, locale: ko })}
        />
      </div>

      {/* 폴더별 테스트 코드 비율(메인) · AI 별 사용량 */}
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <FolderRatioCard
          totalFiles={folderTestRatio.totalFiles}
          folders={folderTestRatio.folders}
        />
        <AiUsageChart data={aiModelUsage} />
      </div>

      {/* 커밋 히트맵 · 최근 PR */}
      <div className="grid gap-4 md:grid-cols-2">
        <CommitHeatmap levels={commitHeatmap} />

        <Card>
          <CardHeader>
            <CardTitle>최근 PR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {pullRequests.map((pr) => (
              <a
                key={pr.id}
                href={pr.url}
                className="hover:bg-muted -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
              >
                <GitPullRequest className="text-muted-foreground size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-muted-foreground font-mono text-xs">#{pr.number}</span>{" "}
                  {pr.title}
                </span>
                <Badge variant={PR_STATUS_VARIANT[pr.status]}>{PR_STATUS_LABEL[pr.status]}</Badge>
                <span className="text-muted-foreground w-12 shrink-0 text-right font-mono text-xs">
                  {format(new Date(pr.updatedAt), "MM.dd")}
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
