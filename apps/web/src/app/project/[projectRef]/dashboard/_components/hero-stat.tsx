import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * 히어로 좌측의 한 칸 — 아이콘 타일 + 라벨 + 값.
 *
 * 아이콘을 컴포넌트 타입이 아니라 ReactNode 로 받는 이유: STATUS 칸만 lucide
 * 아이콘이 아니라 아래 StatusDots(점 3개)다.
 */
export function HeroStat({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="border-border bg-card [&>svg]:text-muted-foreground grid size-14 shrink-0 place-items-center rounded-lg border [&>svg]:size-5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.1em] uppercase">
          {label}
        </p>
        <div className="mt-1.5 truncate text-sm">{children}</div>
      </div>
    </div>
  );
}

/** STATUS 칸의 아이콘. 연결이 살아 있으면 민트, 끊겼으면 빨강. */
export function StatusDots({ ok }: { ok: boolean }) {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", ok ? "bg-brand-mint" : "bg-destructive")}
        />
      ))}
    </span>
  );
}
