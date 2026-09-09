import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiUsageSlice } from "../mock-data";

export function AiUsageChart({ data }: { data: AiUsageSlice[] }) {
  const max = Math.max(...data.map((d) => d.pct));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 사용량 breakdown</CardTitle>
        <span className="text-muted-foreground text-xs">이번 달</span>
      </CardHeader>
      <CardContent>
        <div className="flex h-28 items-end gap-4">
          {data.map((slice) => (
            <div key={slice.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-xs font-medium">{slice.pct}%</span>
              <div
                className="bg-brand-cobalt w-full rounded-t"
                style={{ height: `${(slice.pct / max) * 100}%` }}
              />
              <span className="text-muted-foreground text-center text-[11px] leading-tight text-wrap">
                {slice.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
