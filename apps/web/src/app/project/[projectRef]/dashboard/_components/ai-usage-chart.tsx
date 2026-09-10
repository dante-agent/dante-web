import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiModelUsage } from "../mock-data";

const BAR_COLOR = ["bg-chart-1", "bg-chart-3", "bg-chart-2", "bg-muted-foreground"];

export function AiUsageChart({ data }: { data: AiModelUsage[] }) {
  const max = Math.max(...data.map((d) => d.pct));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>AI 별 사용량</CardTitle>
        <span className="text-muted-foreground text-xs">이번 달</span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <div className="flex items-end gap-4">
          {data.map((usage, i) => (
            <div key={usage.model} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-xs font-medium">{usage.pct}%</span>
              <div className="flex h-16 w-full items-end">
                <div
                  className={`w-full rounded-t ${BAR_COLOR[i % BAR_COLOR.length]}`}
                  style={{ height: `${(usage.pct / max) * 100}%` }}
                />
              </div>
              <p className="text-foreground text-center text-xs leading-tight font-medium text-wrap">
                {usage.model}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
