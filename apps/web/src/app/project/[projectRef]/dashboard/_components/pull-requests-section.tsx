import Link from "next/link";
import type { RecentPullRequest } from "@/lib/projects/dashboard-queries";
import { EmptyPanel, ListPanel, Section, timeAgo } from "./section";
import { StatusChip } from "./status-chip";

/** PR 마다 가장 최근 작업의 결과. 줄을 누르면 기존 PR 화면으로 간다. */
export function PullRequestsSection({
  projectRef,
  pulls,
}: {
  projectRef: string;
  pulls: RecentPullRequest[];
}) {
  return (
    <Section
      title="Pull requests"
      action={
        <span className="text-muted-foreground text-xs">
          Latest test results from pull requests
        </span>
      }
    >
      {pulls.length === 0 ? (
        <EmptyPanel
          title="No pull request results yet"
          hint="When a pull request is opened, Dante writes tests for the changed files, runs them and reports back on GitHub."
          action={{
            href: `/project/${projectRef}/settings/notifications`,
            label: "Pull request settings",
          }}
        />
      ) : (
        <ListPanel>
          {pulls.map((pull) => (
            <Link
              key={pull.prNumber}
              href={`/project/${projectRef}/pull/${pull.prNumber}`}
              className="hover:bg-muted grid grid-cols-[74px_86px_minmax(0,1fr)_72px] items-center gap-3.5 px-4 py-2.5 transition-colors"
            >
              <span className="font-mono text-[12.5px]">#{pull.prNumber}</span>
              <StatusChip tone={pull.tone} label={pull.label} />
              {/* 반쪽 폭이라 긴 에러 문구는 잘린다. 전체는 마우스를 올리면 보인다. */}
              <span className="text-muted-foreground truncate text-[12.5px]" title={pull.note}>
                {pull.note}
              </span>
              <span className="text-muted-foreground text-right text-xs">{timeAgo(pull.at)}</span>
            </Link>
          ))}
        </ListPanel>
      )}
    </Section>
  );
}
