import Link from "next/link";
import { Activity, FileCode2, Terminal } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Section } from "./section";
import type { Advisory } from "../mock-data";

const CATEGORY = {
  coverage: { label: "Coverage", Icon: FileCode2 },
  reliability: { label: "Reliability", Icon: Activity },
  setup: { label: "Setup", Icon: Terminal },
} as const;

// 심각도로 카드 톤이 갈린다. critical 만 배경을 물들이고, warning 은 보더까지만 —
// 세 장 다 물들면 "전부 급함"으로 읽혀서 우선순위가 사라진다.
const SEVERITY = {
  critical: {
    label: "Critical",
    card: "border-destructive/25 bg-destructive/5",
    badge: "border-destructive/40 text-destructive",
  },
  warning: {
    label: "Warning",
    card: "border-brand-orange/25",
    badge: "border-brand-orange/40 text-brand-orange",
  },
} as const;

export function AdvisorSection({
  advisories,
  projectRef,
}: {
  advisories: Advisory[];
  projectRef: string;
}) {
  return (
    <Section
      title={`Advisor found ${advisories.length} ${advisories.length === 1 ? "issue" : "issues"}`}
      action={
        // <a> 로 그리므로 nativeButton 을 꺼야 한다 — 켜두면 Base UI 가
        // "버튼 시맨틱이 사라진다"고 콘솔에 경고한다.
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/project/${projectRef}/recommend`} />}
        >
          View recommendations
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {advisories.map((advisory) => (
          <AdvisoryCard key={advisory.id} advisory={advisory} />
        ))}
      </div>
    </Section>
  );
}

function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const { label, Icon } = CATEGORY[advisory.category];
  const severity = SEVERITY[advisory.severity];
  const [before, after] = advisory.detail;

  return (
    <div className={cn("rounded-lg border p-4", severity.card)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] uppercase">
          <Icon className="size-3.5" strokeWidth={1.5} />
          {label}
        </span>
        <span
          className={cn(
            "rounded-4xl border px-2 py-0.5 font-mono text-[11px] tracking-[0.1em] uppercase",
            severity.badge
          )}
        >
          {severity.label}
        </span>
      </div>

      <p className="mt-6 text-sm">{advisory.title}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        {before}
        <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-xs">
          {advisory.code}
        </code>
        {after}
      </p>
    </div>
  );
}
