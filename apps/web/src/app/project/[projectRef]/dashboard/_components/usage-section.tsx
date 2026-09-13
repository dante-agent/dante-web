import { format } from "date-fns";
import { Section } from "./section";
import type { UsageSeries } from "../mock-data";

/**
 * 지표 줄 — 합계 한 줄 + 표면별 카드.
 *
 * 카드는 가로로 넘친다. 화면이 좁다고 접거나 줄바꿈하지 않고 그대로 스크롤시키는
 * 편이 "표면이 몇 개인지"를 잃지 않는다 (Supabase 프로젝트 홈과 같은 처리).
 */
export function UsageSection({
  series,
  from,
  to,
  passRate,
}: {
  series: UsageSeries[];
  from: string;
  to: string;
  /** null = 판정된 실행이 없음(러너 미연결) → "—". */
  passRate: number | null;
}) {
  const total = series.reduce((sum, s) => sum + s.total, 0);
  const fromLabel = format(new Date(from), "MMM d");
  const toLabel = format(new Date(to), "MMM d");

  return (
    <Section
      title={
        <span className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <Headline value={total.toLocaleString()} label="Total events" />
          <Headline value={passRate === null ? "—" : `${passRate}%`} label="Pass rate" />
        </span>
      }
      action={
        <span className="border-border text-muted-foreground rounded-lg border px-2.5 py-1 text-xs">
          Last 7 days
        </span>
      }
    >
      <div className="flex gap-4 overflow-x-auto pb-1">
        {series.map((s) => (
          <UsageCard key={s.key} series={s} fromLabel={fromLabel} toLabel={toLabel} />
        ))}
      </div>
    </Section>
  );
}

function Headline({ value, label }: { value: string; label: string }) {
  return (
    <span>
      {value} <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function UsageCard({
  series,
  fromLabel,
  toLabel,
}: {
  series: UsageSeries;
  fromLabel: string;
  toLabel: string;
}) {
  return (
    <div className="border-border bg-card w-72 shrink-0 grow rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.1em] uppercase">
          {series.label}
        </p>
        <div className="flex shrink-0 gap-4">
          <Counter label="Failed" value={series.failed} dot="bg-brand-orange" />
          <Counter label="Errors" value={series.errors} dot="bg-destructive" />
        </div>
      </div>

      <p className="mt-1 text-2xl">{series.total.toLocaleString()}</p>

      <Bars points={series.points} />

      <div className="text-muted-foreground mt-2 flex items-center justify-between font-mono text-[11px]">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
    </div>
  );
}

function Counter({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] uppercase">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="mt-1 text-base">{value}</span>
    </div>
  );
}

/** 값이 0 인 구간은 막대를 그리지 않는다 — 1px 이라도 그리면 "조금 있었다"로 읽힌다. */
function Bars({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);

  return (
    <div className="mt-3 flex h-24 items-end gap-[3px]">
      {points.map((point, i) => (
        <div
          key={i}
          className="bg-brand-mint/80 flex-1 rounded-[1px]"
          style={{ height: `${(point / max) * 100}%` }}
        />
      ))}
    </div>
  );
}
