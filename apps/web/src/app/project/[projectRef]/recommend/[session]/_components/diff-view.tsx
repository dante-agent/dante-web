import { cn } from "@/lib/utils";
import type { DiffLine } from "../mock-data";

// 통합(unified) diff 한 벌. Jules 코드 패널처럼 [old #][new #][부호][코드] 4열.
// 추가=초록, 삭제=빨강, 문맥=중립. mock 정적 렌더라 Monaco 없이 가볍게 그린다.
// 실제 생성 결과가 붙으면 Monaco DiffEditor 로 교체할 수 있다(원본↔신규 diff).

const GUTTER = "text-muted-foreground/60 w-10 shrink-0 px-2 text-right tabular-nums select-none";

export function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-x-auto font-mono text-xs leading-5">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            "flex w-max min-w-full whitespace-pre",
            line.kind === "add" && "bg-emerald-500/10",
            line.kind === "del" && "bg-red-500/10"
          )}
        >
          <span className={GUTTER}>{line.oldNo ?? ""}</span>
          <span className={GUTTER}>{line.newNo ?? ""}</span>
          <span
            className={cn(
              "w-5 shrink-0 text-center select-none",
              line.kind === "add" && "text-emerald-400",
              line.kind === "del" && "text-red-400",
              line.kind === "context" && "text-transparent"
            )}
          >
            {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
          </span>
          <code
            className={cn(
              "flex-1 pr-4",
              line.kind === "add" && "text-emerald-200",
              line.kind === "del" && "text-red-200",
              line.kind === "context" && "text-foreground/80"
            )}
          >
            {line.text || " "}
          </code>
        </div>
      ))}
    </div>
  );
}
