import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LEVEL_OPACITY = ["opacity-10", "opacity-30", "opacity-55", "opacity-80", "opacity-100"];

export function CommitHeatmap({ levels }: { levels: number[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>커밋 히트맵</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-flow-col grid-rows-[repeat(7,1fr)] gap-1 overflow-x-auto">
          {levels.map((level, i) => (
            <div
              key={i}
              className={`bg-brand-mint size-2.5 shrink-0 rounded-sm ${LEVEL_OPACITY[level] ?? LEVEL_OPACITY[0]}`}
            />
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex items-center justify-end gap-1.5 text-[11px]">
          <span>적음</span>
          {LEVEL_OPACITY.map((op) => (
            <span key={op} className={`bg-brand-mint size-2 rounded-sm ${op}`} />
          ))}
          <span>많음</span>
        </div>
      </CardContent>
    </Card>
  );
}
