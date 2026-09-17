import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";
import { ClaudeIcon, CodexIcon, GeminiIcon } from "@/components/brand-icons";
import type { BudgetStatus } from "@/lib/ai/budget";
import { ACTIVE_ENGINE } from "@/lib/ai/engine";
import {
  formatUsageCalls,
  formatUsageCost,
  formatUsageTokens,
  formatUsd,
  usageCaveat,
} from "@/lib/ai/usage-format";
import type { MonthlyAiUsage, SurfaceUsage } from "@/lib/ai/usage-queries";
import { Section } from "./section";

/** engine.ts 의 id → 마크. 없는 id 면 이름만 보인다. */
const ENGINE_ICON: Record<string, typeof CodexIcon> = {
  codex: CodexIcon,
  claude: ClaudeIcon,
  gemini: GeminiIcon,
};

/**
 * 사용처마다 이름과 막대·범례 색. 차트 보조색(globals.css · DESIGN.md §2)만 쓴다 —
 * 민트·오렌지·코발트는 대시보드에서 통과·실패·실행 중의 색이라 여기 쓰면 상태처럼 읽힌다.
 */
const SURFACE: Record<SurfaceUsage["surface"], { label: string; fill: string }> = {
  "test-generation": { label: "Test generation", fill: "bg-chart-violet" },
  chat: { label: "Chat", fill: "bg-chart-amber" },
  recommend: { label: "Recommendations", fill: "bg-chart-gray" },
};

/** 항목 줄은 개수와 상관없이 "call", 바닥 줄 전체는 "calls" 로 적는다(표기 규칙). */
const itemCalls = (count: number) => `${count.toLocaleString("en-US")} call`;

/**
 * 이번 달 이 프로젝트의 AI 지출.
 *
 * 막대 전체 = 이 프로젝트 사용액(팀원 전체), 조각 = 어디에 썼나(테스트 생성·채팅·추천).
 * 한도는 막대에 넣지 않는다 — 한도는 사람마다, 모든 프로젝트 합계에 걸려서 이 프로젝트 금액과
 * 나란히 놓으면 "$0.04 / $5.00" 처럼 틀린 안심을 준다. 바닥 줄에 내 계정 기준으로 따로 적고
 * 계정 설정으로 잇는다.
 */
export function AiSpendSection({
  usage,
  bySurface,
  budget,
}: {
  usage: MonthlyAiUsage;
  bySurface: SurfaceUsage[];
  /** 보는 사람 계정의 이번 달 사용량·한도(모든 프로젝트 합계). */
  budget: BudgetStatus;
}) {
  const EngineIcon = ENGINE_ICON[ACTIVE_ENGINE.id];
  const caveat = usageCaveat(usage);
  // 막대는 원가를 아는 금액으로만 나눈다. 전부 모르면 비워 둔다.
  const knownTotal = bySurface.reduce((sum, item) => sum + item.costUsd, 0);
  const shares = bySurface.filter((item) => item.costUsd > 0);
  const summary = shares
    .map((item) => `${SURFACE[item.surface].label} ${formatUsd(item.costUsd)}`)
    .join(", ");

  return (
    <Section title="AI spend">
      {/* flex-1: 옆 칸(Pull requests)이 더 길면 틀을 같이 늘린다. 늘어난 자리는 바닥 줄 위로 간다. */}
      <div className="border-border bg-card @container flex flex-1 flex-col gap-3 rounded-lg border px-[18px] py-4">
        <div className="flex items-center gap-2 text-[13px]">
          {EngineIcon && (
            <span className="bg-muted grid size-6 place-items-center rounded-md">
              <EngineIcon className="size-3.5" />
            </span>
          )}
          {ACTIVE_ENGINE.name}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[26px] leading-none tracking-[-0.02em] tabular-nums">
            {formatUsageCost(usage)}
          </span>
          <span className="text-muted-foreground text-[12.5px]">this project this month</span>
        </div>

        <div
          role="img"
          aria-label={knownTotal > 0 ? `Spend by use: ${summary}` : "No spend this month"}
          className="bg-muted flex h-1.5 gap-0.5 overflow-hidden"
        >
          {knownTotal > 0 &&
            shares.map((item) => (
              <span
                key={item.surface}
                className={cn("h-full shrink-0", SURFACE[item.surface].fill)}
                style={{ width: `${(item.costUsd / knownTotal) * 100}%` }}
              />
            ))}
        </div>

        <ul className="flex flex-col gap-2">
          {bySurface.map((item) => {
            const idle = item.calls === 0;
            return (
              <li
                key={item.surface}
                className={cn(
                  "grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]",
                  idle ? "text-muted-foreground" : "text-foreground/80"
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-2.5 rounded-[2px]", SURFACE[item.surface].fill)}
                />
                <span className="truncate">
                  {SURFACE[item.surface].label} · {itemCalls(item.calls)}
                </span>
                <span
                  className={cn("font-mono text-[12.5px] tabular-nums", !idle && "text-foreground")}
                >
                  {formatUsd(item.costUsd)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="text-muted-foreground mt-auto flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12.5px]">
          {usage.calls === 0 ? (
            <span>No AI usage this month yet.</span>
          ) : (
            <>
              <span>
                <span className="text-foreground/80 font-mono tabular-nums">
                  {formatUsageTokens(usage)}
                </span>{" "}
                tokens
              </span>
              <span>
                <span className="text-foreground/80 font-mono tabular-nums">
                  {formatUsageCalls(usage)}
                </span>{" "}
                calls
              </span>
            </>
          )}
          <Link
            href="/account/settings/ai"
            // 한 줄에 다 들어가는 폭(패널 30rem 이상)에서만 오른쪽 끝에 붙인다. 좁으면 다음 줄 왼쪽에서 시작한다.
            className="group hover:text-foreground inline-flex items-center gap-1 transition-colors @[30rem]:ml-auto"
          >
            Account{" "}
            <span
              className={cn(
                "font-mono tabular-nums",
                budget.exceeded ? "text-destructive" : "text-foreground/80"
              )}
            >
              {formatUsd(budget.usedUsd)}
            </span>{" "}
            / <span className="font-mono tabular-nums">{formatUsd(budget.limitUsd)}</span>
            <span aria-hidden>·</span> Resets {usage.resetsDayLabel}
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>

        {caveat && <p className="text-muted-foreground text-[12.5px] leading-relaxed">{caveat}</p>}
      </div>
    </Section>
  );
}
