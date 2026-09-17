import Link from "next/link";
import { cn } from "cn";
import { DASHBOARD_LIST_LIMIT, type RecentRun } from "@/lib/projects/dashboard-queries";
import { ArrowLink, EmptyPanel, LIST_ROW, ListPanel, PathLabel, Section, timeAgo } from "./section";
import { StatusChip } from "./status-chip";

const STATUS_LABEL: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  error: "Error",
  running: "Running",
  queued: "Queued",
};

/** 42s · 1m 04s. 못 잰 실행은 "—". */
function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * 폴더 보기·채팅에서 돌린 최근 실행. 줄을 누르면 그 파일을 연다.
 *
 * 실행이 목록을 다 못 채우면(1~4개) 남는 자리에 어디서 채우는지 안내한다. 옆의 Up next 에 맞춰
 * 틀이 늘어나는데, 그 자리를 비워 두면 데이터가 빠진 것처럼 읽힌다. 0개면 빈 상태, 다 차면 안내 없음.
 */
export function RecentRunsSection({ projectRef, runs }: { projectRef: string; runs: RecentRun[] }) {
  const explorer = `/project/${projectRef}/folder`;
  return (
    <Section title="Recent runs">
      {runs.length === 0 ? (
        <EmptyPanel
          title="No test runs yet"
          hint="Open a test in Explorer and press Run. Results show up here."
          action={{ href: explorer, label: "Open Explorer" }}
        />
      ) : (
        <ListPanel
          footer={
            runs.length < DASHBOARD_LIST_LIMIT && (
              <div className="border-input bg-background/40 flex flex-1 flex-col items-center justify-center gap-2 border-t border-dashed px-4 py-4 text-center">
                <p className="text-muted-foreground text-[12.5px]">
                  Runs from Explorer and AI chat show up here.
                </p>
                <ArrowLink href={explorer}>Open Explorer</ArrowLink>
              </div>
            )
          }
        >
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/project/${projectRef}/folder?file=${encodeURIComponent(run.sourcePath)}`}
              className={cn(LIST_ROW, "hover:bg-muted transition-colors")}
            >
              <StatusChip tone={run.status} label={STATUS_LABEL[run.status] ?? run.status} />
              <PathLabel path={run.testPath} />
              <span className="flex flex-col items-end gap-0.5 text-[11.5px]">
                <span className="text-foreground/80 font-mono tabular-nums">
                  {formatDuration(run.durationMs)}
                </span>
                <span className="text-muted-foreground">{timeAgo(run.at)}</span>
              </span>
            </Link>
          ))}
        </ListPanel>
      )}
    </Section>
  );
}
