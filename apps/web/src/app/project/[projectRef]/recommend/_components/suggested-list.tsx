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
}: {
  projectRef: string;
  recommendations: TestRecommendation[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {recommendations.map((rec) => (
        <li
          key={rec.id}
          className="bg-card border-border flex items-start gap-3 rounded-xl border p-4"
        >
          <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
            <FileCode2 className="text-muted-foreground size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{rec.componentName}</span>
              <Badge variant={PRIORITY_VARIANT[rec.priority]}>{PRIORITY_LABEL[rec.priority]}</Badge>
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
      ))}
    </ul>
  );
}
