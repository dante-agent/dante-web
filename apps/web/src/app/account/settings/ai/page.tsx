import type { Metadata } from "next";
import { EngineCards } from "@/components/ai/engine-cards";
import { AiQualityForm } from "@/components/settings/ai/quality-form";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { getMonthlyBudgetStatus, type BudgetStatus } from "@/lib/ai/budget";
import { ACTIVE_ENGINE } from "@/lib/ai/engine";
import { getUserAiQuality } from "@/lib/ai/quality-queries";
import {
  formatUsageCalls,
  formatUsageCost,
  formatUsageTokens,
  formatUsd,
  usageCaveat,
} from "@/lib/ai/usage-format";
import { getMonthlyUserAiUsage, type MonthlyAiUsage } from "@/lib/ai/usage-queries";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "AI settings" };

// AI 엔진.
//
// 예전에는 프로바이더별 키를 넣고 지우는 화면이었다. 지금은 Dante 가 프로바이더와
// 직접 계약하므로 관리할 키가 없다 — 무엇이 붙어 있는지만 알린다.
// 카드는 온보딩 4단계와 같은 것을 쓴다(components/ai/engine-cards.tsx).
//
// 사용량이 여기 있는 이유: 원가를 Dante 가 대신 내므로 한도는 사용자 단위로 걸린다
// (AiUsage.userId). 프로젝트 대시보드에도 같은 숫자가 있지만 그건 그 프로젝트 몫이고,
// "내가 이번 달 얼마나 썼나"에 답하는 자리는 계정 설정이다.
//
// 한도도 여기서 보여준다. 약관 제10조가 "회원이 자신의 사용량과 이용한도를 화면에서
// 확인할 수 있도록" 하겠다고 약속한다.
export default async function AccountAiPage() {
  const user = await requireUser();
  const [usage, budget, quality] = await Promise.all([
    getMonthlyUserAiUsage(user.id),
    getMonthlyBudgetStatus(user.id),
    getUserAiQuality(user.id),
  ]);

  return (
    <>
      <SettingsHeader
        title="AI"
        description={`Dante calls ${ACTIVE_ENGINE.name} on your behalf. There is no key to manage.`}
      />

      <div className="mt-8 max-w-2xl">
        <EngineCards />
      </div>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-[15px] font-medium">Generation quality</h2>
        <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
          The default for this account. Both use the same model. Deep lets it think longer.
        </p>
        <div className="mt-4">
          <AiQualityForm initial={quality} />
        </div>
      </section>

      <PlanLimit budget={budget} />

      <UsageThisMonth usage={usage} />

      <ComingSoon>Overriding the engine per project.</ComingSoon>
    </>
  );
}

/**
 * 플랜과 이번 달 한도.
 *
 * 숫자는 차단을 판정하는 getMonthlyBudgetStatus 에서 그대로 받는다. 화면용으로 따로
 * 합산하면 "화면에는 여유가 있는데 막혔다"가 생긴다.
 */
function PlanLimit({ budget }: { budget: BudgetStatus }) {
  // 한도 0 은 "AI 끔"이다. 나눗셈을 하지 않고 따로 말한다.
  const percent = budget.limitUsd > 0 ? Math.floor((budget.usedUsd / budget.limitUsd) * 100) : 100;

  return (
    <section className="mt-10 max-w-2xl">
      <h2 className="text-[15px] font-medium">Plan and limit</h2>

      <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
        Dante pays the model provider, so each account has a monthly spending limit. Plans are set
        by the Dante team for now. There is nothing to buy yet.
      </p>

      <dl className="border-border divide-border bg-card mt-4 divide-y border">
        <Field label="Plan" value={budget.planName ?? "Default"} />
        <Field label="Monthly limit" value={formatUsd(budget.limitUsd)} />
        <div className="px-5 py-4">
          <div className="flex items-baseline gap-4">
            <dt className="text-muted-foreground w-32 shrink-0 text-[13px]">Used</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">
              {formatUsd(budget.usedUsd)}
              {budget.limitUsd > 0 && <span className="text-muted-foreground"> ({percent}%)</span>}
            </dd>
          </div>
          <div
            className="bg-muted mt-3 h-1.5 overflow-hidden"
            role="progressbar"
            aria-label="Share of monthly limit used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
          >
            <div
              className={budget.exceeded ? "bg-destructive h-full" : "bg-foreground h-full"}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </div>
        <Field label="Resets" value={budget.period.resetsLabel} />
      </dl>

      {budget.exceeded && (
        <p className="text-destructive mt-3 text-[13px] leading-relaxed">
          {budget.limitUsd > 0
            ? "You have used this month's limit. AI features are paused until the reset above."
            : "AI features are turned off for this account."}
        </p>
      )}

      {/* Used 가 아래 Cost 보다 클 수 있는 이유를 말한다. 안 말하면 두 숫자가 틀려 보인다. */}
      {budget.unknownCalls > 0 && (
        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          Used counts {budget.unknownCalls === 1 ? "1 call" : `${budget.unknownCalls} calls`} with
          no price on file at a fixed estimate, so it can be higher than Cost below.
        </p>
      )}
    </section>
  );
}

/** 이번 달 사용량. 값이 사용자마다 다르지만 읽기 전용이라 서버에서 그대로 그린다. */
function UsageThisMonth({ usage }: { usage: MonthlyAiUsage }) {
  const caveat = usageCaveat(usage);

  return (
    <section className="mt-10 max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-medium">Usage this month</h2>
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.1em] uppercase">
          {usage.periodLabel}
        </span>
      </div>

      <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
        Everything this account spent across every project. Counted per account, not per project.
      </p>

      <dl className="border-border divide-border bg-card mt-4 divide-y border">
        <Field label="Cost" value={formatUsageCost(usage)} />
        <Field label="Tokens" value={formatUsageTokens(usage)} />
        <Field label="Calls" value={formatUsageCalls(usage)} />
      </dl>

      {/* 0 건일 때는 숫자 세 줄만 보면 "고장인가"로 읽힐 수 있어 한 줄 덧붙인다. */}
      {usage.calls === 0 && (
        <p className="text-muted-foreground mt-3 text-[13px]">No AI calls yet this month.</p>
      )}

      {caveat && <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">{caveat}</p>}
    </section>
  );
}

/** account/settings/general 의 같은 이름 컴포넌트와 마크업을 맞춘다. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 px-5 py-4">
      <dt className="text-muted-foreground w-32 shrink-0 text-[13px]">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">{value}</dd>
    </div>
  );
}
