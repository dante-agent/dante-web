import { FileCode2 } from "lucide-react";
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

export function SuggestedList({
  projectRef,
  recommendations,
  selected,
  onToggle,
  selectionFull,
}: {
  projectRef: string;
  recommendations: TestRecommendation[];
  /** 배치 생성으로 고른 파일 경로들. */
  selected: Set<string>;
  onToggle: (filePath: string) => void;
  /** 최대 선택 수에 도달했는지 — 도달하면 안 고른 카드의 체크박스를 잠근다. */
  selectionFull: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {recommendations.map((rec) => {
        const checked = selected.has(rec.filePath);
        return (
          <li
            key={rec.id}
            className="bg-card border-border flex items-start gap-3 rounded-xl border p-4"
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!checked && selectionFull}
              onChange={() => onToggle(rec.filePath)}
              aria-label={`Select ${rec.componentName} for batch generation`}
              className="accent-primary mt-1 size-4 shrink-0 disabled:opacity-40"
            />
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <FileCode2 className="text-muted-foreground size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{rec.componentName}</span>
                <Badge variant={PRIORITY_VARIANT[rec.priority]}>
                  {PRIORITY_LABEL[rec.priority]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                {rec.filePath}
              </p>
              <p className="text-foreground mt-1.5 text-sm">{rec.reason}</p>
            </div>
            <GenerateTestButton
              projectRef={projectRef}
              filePath={rec.filePath}
              componentName={rec.componentName}
            />
          </li>
        );
      })}
    </ul>
  );
}
