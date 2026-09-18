import { cn } from "@/lib/utils";

// 줄 폭(%). 코드처럼 들쭉날쭉하게 보이도록 고정 패턴을 쓴다. 0 은 빈 줄.
const LINES = [38, 62, 0, 54, 80, 72, 46, 0, 58, 86, 66, 30, 0, 50, 74];

/** AI 응답을 기다리는 동안 코드 자리에 까는 회색 줄. pulsing 이면 깜빡인다. */
export function CodeSkeleton({ pulsing }: { pulsing: boolean }) {
  return (
    <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden bg-black px-6 py-4">
      {LINES.map((width, index) =>
        width === 0 ? (
          <div key={index} className="h-3" />
        ) : (
          <div
            key={index}
            className={cn(
              "bg-muted/60 h-3 rounded",
              pulsing && "animate-pulse motion-reduce:animate-none"
            )}
            style={{ width: `${width}%`, animationDelay: `${index * 60}ms` }}
          />
        )
      )}
    </div>
  );
}
