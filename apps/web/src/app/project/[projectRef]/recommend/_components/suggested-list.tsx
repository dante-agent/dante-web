import { useState } from "react";
import { ChevronDown, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RecommendationPriority, TestRecommendation } from "@/lib/projects/recommendations";
import { GenerateTestButton } from "./generate-test-button";

const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_VARIANT: Record<RecommendationPriority, "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

/** 한 번에 배치 생성할 수 있는 최대 개수(서버 MAX_MATCHES 와 맞춘다). */
export const MAX_SELECT = 3;

/** 처음에 보여줄 줄 수. 아래 화살표를 누를 때마다 STEP 만큼 늘어난다. */
const VISIBLE = 6;
const STEP = 3;

export function SuggestedList({
  projectRef,
  recommendations,
  selectMode,
  selected,
  onToggle,
  selectionFull,
}: {
  projectRef: string;
  recommendations: TestRecommendation[];
  /** 선택 모드. 켜지면 카드의 화살표가 체크박스로 바뀐다. */
  selectMode: boolean;
  /** 배치 생성으로 고른 파일 경로들. */
  selected: Set<string>;
  onToggle: (filePath: string) => void;
  /** 최대 선택 수에 도달했는지 — 도달하면 안 고른 카드는 더 고를 수 없다. */
  selectionFull: boolean;
}) {
  const [limit, setLimit] = useState(VISIBLE);
  const visible = recommendations.slice(0, limit);
  const hidden = recommendations.length - visible.length;

  return (
    <>
      <ul className="-mx-1 flex flex-col">
        {visible.map((rec) => {
          const checked = selected.has(rec.filePath);
          return (
            <li
              key={rec.id}
              className={cn(
                // hover 는 줄 전체가 받는다 — 한 덩어리로 읽히게.
                "group hover:bg-muted/50 border-border/60 flex flex-col rounded-lg border-b transition-colors last:border-0",
                // 고른 줄은 목록 안에서도 눈에 남는다 — 바가 화면 아래 붙어 있어도 무엇을 골랐는지 보이게.
                checked && "bg-primary/[0.06]"
              )}
            >
              <GenerateTestButton
                projectRef={projectRef}
                filePath={rec.filePath}
                componentName={rec.componentName}
                selectMode={selectMode}
                checked={checked}
                onToggle={() => onToggle(rec.filePath)}
                selectionFull={selectionFull}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {/* 아이콘은 파일 이름 바로 앞에 — 별도 상자로 빼면 왼쪽이 그만큼 비어 보인다. */}
                    <FileCode2 className="text-muted-foreground size-4 shrink-0" />
                    <span className="font-mono text-sm font-medium">{rec.componentName}</span>
                    <Badge variant={PRIORITY_VARIANT[rec.priority]}>
                      {PRIORITY_LABEL[rec.priority]}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate font-mono text-xs">
                    {rec.filePath}
                  </span>
                  <span className="text-foreground mt-1.5 block text-sm">{rec.reason}</span>
                </span>
              </GenerateTestButton>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setLimit((prev) => prev + STEP)}
          title={`Show ${Math.min(STEP, hidden)} more`}
          aria-label={`Show ${Math.min(STEP, hidden)} more`}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 -mx-1 flex justify-center rounded-lg py-2 transition-colors"
        >
          <ChevronDown className="size-4" />
        </button>
      )}
    </>
  );
}
