import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LEVEL_OPACITY = ["opacity-10", "opacity-30", "opacity-55", "opacity-80", "opacity-100"];

export function CommitHeatmap({ levels }: { levels: number[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>커밋 히트맵</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <div className="grid grid-flow-col grid-rows-[repeat(7,10px)] gap-1 overflow-x-auto">
          {levels.map((level, i) => (
            <div
              key={i}
              className={`bg-brand-mint size-2.5 shrink-0 rounded-[2px] ${LEVEL_OPACITY[level] ?? LEVEL_OPACITY[0]}`}
            />
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex items-center justify-end gap-1.5 text-xs">
          <span>적음</span>
          {LEVEL_OPACITY.map((op) => (
            <span key={op} className={`bg-brand-mint size-2.5 rounded-[2px] ${op}`} />
          ))}
          <span>많음</span>
        </div>
      </CardContent>
    </Card>
  );
}
