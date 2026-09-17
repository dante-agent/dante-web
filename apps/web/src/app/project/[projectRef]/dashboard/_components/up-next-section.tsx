import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";
import { getUpNext } from "@/lib/projects/dashboard-queries";
import type { ProjectRepo } from "@/lib/projects/queries";
import type { RecommendationPriority, TestRecommendation } from "@/lib/projects/recommendations";
import { ArrowLink, Ghost, LIST_ROW, ListPanel, PathLabel, Section } from "./section";
import { StatusChip } from "./status-chip";

/**
 * 우선순위는 옆 Recent runs 와 같은 StatusChip(네모 + 글자)으로, 색 없이 밝기로만 나눈다 — 두 목록이
 * 한 문법·같은 여백으로 읽힌다. 오렌지는 대시보드에서 "실패"의 색이라 쓰지 않는다.
 */
const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * 폴더 뒤에 붙이는 짧은 사유. medium 의 사유("No test file yet")는 목록 제목과 같은 말이라 뺀다.
 * 전체 문구는 recommendations.ts 의 classify 에 있다.
 */
const SHORT_REASON: Partial<Record<RecommendationPriority, string>> = {
  high: "Core logic",
  low: "Simple UI",
};

function Frame({ projectRef, children }: { projectRef: string; children: React.ReactNode }) {
  return (
    <Section
      title="Up next"
      action={<ArrowLink href={`/project/${projectRef}/recommend`}>All recommendations</ArrowLink>}
    >
      {children}
    </Section>
  );
}

/**
 * AI Recommendations 의 Suggested 목록 앞부분. 줄을 누르면 그 파일을 열어 거기서 생성한다.
 * GitHub 트리를 기다리므로 페이지가 Suspense 로 감싼다.
 */
export async function UpNextSection({
  projectRef,
  repo,
  projectId,
}: {
  projectRef: string;
  repo: ProjectRepo;
  projectId: string;
}) {
  let items: TestRecommendation[];
  try {
    items = await getUpNext(repo, projectId);
  } catch (error) {
    console.error("[dashboard] up next", error);
    return null;
  }

  return (
    <Frame projectRef={projectRef}>
      {items.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-1 items-center justify-center rounded-lg border px-4 py-5 text-[13px]">
          Every source file has a test.
        </div>
      ) : (
        <ListPanel>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/project/${projectRef}/folder?file=${encodeURIComponent(item.filePath)}`}
              className={cn(LIST_ROW, "group hover:bg-muted transition-colors")}
            >
              <StatusChip tone={item.priority} label={PRIORITY_LABEL[item.priority]} />
              <PathLabel path={item.filePath} extra={SHORT_REASON[item.priority]} />
              {/* 오른쪽 끝을 잡아 옆 목록(시간 칸)과 줄 모양을 맞추고, 누르면 파일로 간다는 걸 보인다. */}
              <ArrowRight
                aria-hidden
                className="text-muted-foreground group-hover:text-foreground size-3.5 transition-[color,transform] duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          ))}
        </ListPanel>
      )}
    </Frame>
  );
}

/**
 * 불러오는 동안의 뼈대. 실제 줄과 같은 LIST_ROW·우선순위 글자·PathLabel 에 글자만 가려 넣는다 —
 * 줄 높이가 구조적으로 같아 불러온 뒤 튀지 않는다. 줄 수는 getUpNext 기본값과 같다.
 */
export function UpNextSkeleton({ projectRef }: { projectRef: string }) {
  const paths = [
    "src/components/placeholder/Component.tsx",
    "src/features/placeholder/usePlaceholder.ts",
    "src/lib/placeholder.ts",
    "src/app/placeholder/page.tsx",
    "src/components/ui/placeholder.tsx",
  ];
  return (
    <Frame projectRef={projectRef}>
      <div role="status" aria-label="Loading recommendations" className="flex flex-1 flex-col">
        <ListPanel>
          {paths.map((path) => (
            <div key={path} className={LIST_ROW}>
              <span className="text-[11.5px] whitespace-nowrap">
                <Ghost>▪ Medium</Ghost>
              </span>
              <PathLabel path={path} ghost />
              <span aria-hidden className="size-3.5" />
            </div>
          ))}
        </ListPanel>
      </div>
    </Frame>
  );
}
