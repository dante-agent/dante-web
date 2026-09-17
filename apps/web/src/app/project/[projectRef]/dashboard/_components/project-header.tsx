import type { ReactNode } from "react";
import { FlaskConical, GitBranch } from "lucide-react";
import { cn } from "cn";
import { GitHubIcon } from "@/components/brand-icons";
import type { DashboardProject } from "@/lib/projects/queries";
import type { ConnectionStatus } from "@/lib/github/connection";
import { CopyButton } from "./copy-button";

/**
 * 상태 한 단어. 자세한 안내(무엇을 눌러야 하는지)는 연결 배너가 따로 한다 —
 * 여기는 한 줄이라 사유만 적는다.
 */
const STATUS_LABEL: Record<ConnectionStatus, string> = {
  ok: "Healthy",
  suspended: "Suspended",
  app_removed: "App removed",
  repo_removed: "Repo removed",
  repo_deleted: "Repo deleted",
};

/**
 * 프로젝트 이름 + 한 줄 메타. 한 번 보면 안 바뀌는 값들이라 타일로 크게 그리지 않는다.
 * 제목 크기는 /projects 의 h1 과 같다.
 */
export function ProjectHeader({ project }: { project: DashboardProject }) {
  const repoPath = `${project.repoOwner}/${project.repoName}`;
  const ok = project.connection === "ok";

  return (
    <header>
      <h1 className="font-heading text-[26px] leading-[1.2] font-medium tracking-[-0.02em]">
        {project.name}
      </h1>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
        <Fact>
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              ok ? "bg-brand-mint ring-brand-mint/15 ring-[3px]" : "bg-destructive"
            )}
          />
          {STATUS_LABEL[project.connection]}
        </Fact>
        <Dot />
        <Fact>
          <GitHubIcon className="size-3.5" />
          <span className="text-foreground/80 font-mono text-xs">{repoPath}</span>
          <CopyButton value={`https://github.com/${repoPath}`} />
        </Fact>
        <Dot />
        <Fact>
          <GitBranch className="size-3.5" strokeWidth={1.5} />
          <span className="text-foreground/80 font-mono text-xs">{project.defaultBranch}</span>
        </Fact>
        <Dot />
        <Fact>
          <FlaskConical className="size-3.5" strokeWidth={1.5} />
          {project.testFramework ? (
            <span className="text-foreground/80 font-mono text-xs">{project.testFramework}</span>
          ) : (
            "No runner set"
          )}
        </Fact>
      </div>
    </header>
  );
}

function Fact({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/50">
      ·
    </span>
  );
}
