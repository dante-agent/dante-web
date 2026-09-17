import { cn } from "cn";

/**
 * 실행·PR 결과를 색 점 + 글자로. 색만으로 구분하지 않게 글자를 같이 쓴다.
 * failed(테스트가 떨어짐)와 error(아예 못 돔)는 사용자가 할 일이 달라 색도 다르다.
 * Up next 의 우선순위도 같은 칩을 쓴다 — 두 목록의 첫 칸이 같은 모양이 되게. 색 대신 밝기로만 나눈다.
 */
const TONE: Record<string, string> = {
  passed: "text-brand-mint",
  failed: "text-brand-orange",
  error: "text-destructive",
  running: "text-brand-cobalt",
  queued: "text-muted-foreground",
  skipped: "text-muted-foreground",
  high: "text-foreground font-medium",
  medium: "text-foreground/70",
  low: "text-muted-foreground",
};

export function StatusChip({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] whitespace-nowrap",
        TONE[tone] ?? "text-muted-foreground"
      )}
    >
      <span aria-hidden className="size-[7px] shrink-0 rounded-[2px] bg-current" />
      {label}
    </span>
  );
}
