import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/ai/usage-format";
import { requireOpsUser } from "@/lib/ops/access";
import { getOpsMetrics, type Counts, type OpsMetrics } from "@/lib/ops/metrics";

export const metadata: Metadata = { title: "Ops" };

// 매 요청 새로 센다. 지표 화면이 캐시된 숫자를 보여주면 "지금 몇 명 들어와 있나"에
// 답하지 못한다 — 이 화면이 존재하는 이유가 그 질문이다.
export const dynamic = "force-dynamic";

/**
 * 운영 지표. 볼 수 있는 사람은 OPS_EMAILS 에 적힌 계정뿐이다(lib/ops/access.ts).
 *
 * GA·Vercel Analytics 와 나눠 쓰는 화면이다. 방문자 수·유입 경로는 그쪽이 정확하고,
 * 여기는 로그인 뒤의 일 — 가입·레포 연결·테스트 실행·AI 지출 — 을 우리 DB 에서 직접 센다.
 * 외부 도구는 집계까지 몇 분 걸리고 광고 차단기에 막히기도 하는데, 이 숫자는 그렇지 않다.
 */
export default async function OpsPage() {
  await requireOpsUser();
  const metrics = await getOpsMetrics();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-lg font-semibold">Ops</h1>
        <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
          Live counts from our own database. Visitor numbers live in Vercel Analytics and GA.
        </p>
      </header>

      <DemoBudgetNotice budget={metrics.demoBudget} />

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <CountCard title="Signups" counts={metrics.signups} />
        <CountCard title="Projects" counts={metrics.projects} />
        <CountCard title="Test runs" counts={metrics.testRuns} />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <AiSpendCard ai={metrics.ai} />
        <RunStatusCard statuses={metrics.runStatuses} />
      </section>

      <RecentSignups signups={metrics.recentSignups} />
    </main>
  );
}

/**
 * 데모 계정 한도. 심사관 여럿이 계정 하나를 나눠 쓰므로 이 막대가 차면 그 뒤에
 * 들어온 사람은 AI 가 막힌 화면을 본다 — 그래서 다른 숫자보다 위에 둔다.
 */
function DemoBudgetNotice({ budget }: { budget: OpsMetrics["demoBudget"] }) {
  if (!budget) return null;

  const ratio = budget.limitUsd > 0 ? budget.usedUsd / budget.limitUsd : 1;
  const percent = Math.min(100, Math.round(ratio * 100));
  // 80% 를 경고선으로 잡았다. 남은 20% 안에서 한도를 올리거나 플랜을 붙일 시간이 있다.
  const tight = budget.exceeded || ratio >= 0.8;

  return (
    <Card className={tight ? "border-destructive mt-8" : "mt-8"}>
      <CardHeader>
        <CardTitle>Demo account budget</CardTitle>
        <Badge variant={budget.exceeded ? "destructive" : tight ? "outline" : "secondary"}>
          {budget.exceeded ? "Exhausted" : `${percent}%`}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl">
          {formatUsd(budget.usedUsd)}
          <span className="text-muted-foreground text-sm"> / {formatUsd(budget.limitUsd)}</span>
        </p>
        <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={tight ? "bg-destructive h-full" : "bg-foreground h-full"}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          {budget.email} · {budget.planName ?? "no plan (env default)"} · resets{" "}
          {budget.period.resetsDayLabel}
        </p>
        {budget.exceeded ? (
          <p className="text-destructive mt-2 text-[13px] leading-relaxed">
            AI calls from this account are blocked until the limit resets. Raise
            AI_MONTHLY_BUDGET_USD or attach a plan with a higher limit.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CountCard({ title, counts }: { title: string; counts: Counts }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl">{counts.total.toLocaleString("en-US")}</p>
        <p className="text-muted-foreground mt-2 text-[13px]">
          +{counts.last24h.toLocaleString("en-US")} today · +{counts.last7d.toLocaleString("en-US")}{" "}
          this week
        </p>
      </CardContent>
    </Card>
  );
}

function AiSpendCard({ ai }: { ai: OpsMetrics["ai"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI spend</CardTitle>
        <span className="text-muted-foreground text-xs">{ai.periodLabel}</span>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl">{formatUsd(ai.costUsd)}</p>
        <p className="text-muted-foreground mt-2 text-[13px]">
          {ai.calls.toLocaleString("en-US")} calls, everyone
        </p>
        {/* 빠진 건이 있으면 말한다 — 합계만 크게 띄우면 화면이 거짓말을 한 셈이 된다. */}
        {ai.unknownCostCalls > 0 ? (
          <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
            At least: {ai.unknownCostCalls.toLocaleString("en-US")} call(s) reported no cost.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RunStatusCard({ statuses }: { statuses: OpsMetrics["runStatuses"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test runs by status</CardTitle>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">No runs yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {statuses.map(({ status, count }) => (
              <li key={status} className="flex items-center justify-between text-[13px]">
                {/* error 는 실행 자체가 안 된 것 — 우리가 볼 거리다(TestRun.status 주석). */}
                <Badge variant={status === "error" ? "destructive" : "secondary"}>{status}</Badge>
                <span className="font-mono">{count.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSignups({ signups }: { signups: OpsMetrics["recentSignups"] }) {
  return (
    <section className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Recent signups</CardTitle>
        </CardHeader>
        <CardContent>
          {signups.length === 0 ? (
            <p className="text-muted-foreground text-[13px]">Nobody yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {signups.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-[13px]">
                    {user.githubLogin ?? user.email ?? user.id}
                  </span>
                  {/*
                    시각은 서버에서 찍는다. 목록을 훑는 용도라 보는 사람 시간대와
                    몇 시간 어긋나도 상관없고, 클라이언트에서 다시 그리면
                    하이드레이션이 어긋난다.
                  */}
                  <time
                    dateTime={user.createdAt.toISOString()}
                    className="text-muted-foreground shrink-0 font-mono text-xs"
                  >
                    {user.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
