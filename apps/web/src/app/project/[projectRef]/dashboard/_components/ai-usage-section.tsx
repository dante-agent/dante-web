import { Coins, DollarSign, MessageSquare } from "lucide-react";
import {
  formatUsageCalls,
  formatUsageCost,
  formatUsageTokens,
  usageCaveat,
} from "@/lib/ai/usage-format";
import type { MonthlyAiUsage } from "@/lib/ai/usage-queries";
import { HeroStat } from "./hero-stat";
import { Section } from "./section";

/**
 * 이 프로젝트에서 쓴 AI 사용량. 위쪽 UsageSection 과 달리 목업이 아니라 실제 집계다.
 *
 * 두 섹션을 합치지 않은 이유: UsageSection 은 "최근 7일, 표면별 이벤트 수"이고
 * 이쪽은 "이번 달, 돈"이다. 축(기간)과 단위(건수 vs USD)가 둘 다 달라서 한 줄에
 * 놓으면 카드마다 무엇을 기준으로 읽어야 하는지가 흐려진다.
 *
 * 막대 그래프를 붙이지 않았다. 일별 추이는 groupBy 한 번이면 나오지만, 지금은
 * 사용자가 먼저 알아야 하는 게 "이번 달 얼마"라서 HeroStat 세 칸으로 둔다.
 */
export function AiUsageSection({ usage }: { usage: MonthlyAiUsage }) {
  const caveat = usageCaveat(usage);

  return (
    <Section
      title="AI usage"
      action={
        <span className="border-border text-muted-foreground rounded-lg border px-2.5 py-1 text-xs">
          {usage.periodLabel}
        </span>
      }
    >
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-3">
        <HeroStat icon={<DollarSign strokeWidth={1.5} />} label="Cost">
          {formatUsageCost(usage)}
        </HeroStat>

        <HeroStat icon={<Coins strokeWidth={1.5} />} label="Tokens">
          {formatUsageTokens(usage)}
        </HeroStat>

        <HeroStat icon={<MessageSquare strokeWidth={1.5} />} label="Calls">
          {formatUsageCalls(usage)}
        </HeroStat>
      </div>

      {usage.calls === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing yet this month. Asking Dante about this project is what fills this in.
        </p>
      )}

      {caveat && <p className="text-muted-foreground text-sm leading-relaxed">{caveat}</p>}
    </Section>
  );
}
