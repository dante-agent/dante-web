import { EngineCards } from "@/components/ai/engine-cards";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { ACTIVE_ENGINE } from "@/lib/ai/engine";
import {
  formatUsageCalls,
  formatUsageCost,
  formatUsageTokens,
  usageCaveat,
} from "@/lib/ai/usage-format";
import { getMonthlyUserAiUsage, type MonthlyAiUsage } from "@/lib/ai/usage-queries";
import { requireUser } from "@/lib/auth/user";

// AI 엔진.
//
// 예전에는 프로바이더별 키를 넣고 지우는 화면이었다. 지금은 Dante 가 프로바이더와
// 직접 계약하므로 관리할 키가 없다 — 무엇이 붙어 있는지만 알린다.
// 카드는 온보딩 4단계와 같은 것을 쓴다(components/ai/engine-cards.tsx).
//
// 사용량이 여기 있는 이유: 원가를 Dante 가 대신 내므로 한도는 사용자 단위로 걸린다
// (AiUsage.userId). 프로젝트 대시보드에도 같은 숫자가 있지만 그건 그 프로젝트 몫이고,
// "내가 이번 달 얼마나 썼나"에 답하는 자리는 계정 설정이다.
export default async function AccountAiPage() {
  const user = await requireUser();
  const usage = await getMonthlyUserAiUsage(user.id);

  return (
    <>
      <SettingsHeader
        title="AI"
        description={`Dante calls ${ACTIVE_ENGINE.name} on your behalf. There is no key to manage.`}
      />

      <div className="mt-8 max-w-2xl">
        <EngineCards />
      </div>

      <UsageThisMonth usage={usage} />

      <ComingSoon>
        Credit balance and plans, picking generation quality (Standard vs. Deep), and overriding the
        engine per project.
      </ComingSoon>
    </>
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
