import { prisma } from "@dante/db";
import { currentBillingPeriod } from "@/lib/ai/billing-period";
import { getMonthlyBudgetStatus, type BudgetStatus } from "@/lib/ai/budget";

// 서버 전용. 운영자가 "지금 몇 명이 들어와서 무엇을 했나"를 보는 데 필요한 합계.
//
// 외부 분석 도구(GA·Vercel Analytics)와 역할이 다르다. 그쪽은 로그인 전 방문자를 세고,
// 여기는 로그인 후에 실제로 무슨 일이 벌어졌는지를 센다 — 가입, 레포 연결, 테스트 실행.
// 방문자 수는 그쪽이 정확하고, "가입까지 갔나"는 여기가 정확하다.
//
// 새 표를 만들지 않는다. 필요한 값이 전부 기존 표에 이미 쌓이고 있어서, 집계용 표를
// 따로 두면 같은 사실을 두 곳에서 세게 된다(그리고 둘은 언젠가 갈라진다).

/** 최근 구간 두 개를 같이 보는 이유: 총계만으로는 "지금 들어오는 중"인지 알 수 없다. */
export type Counts = {
  total: number;
  last24h: number;
  last7d: number;
};

export type OpsMetrics = {
  signups: Counts;
  projects: Counts;
  testRuns: Counts;
  /** 테스트 실행 상태 분포(전체 기간). error 가 늘면 우리 쪽 문제다 — TestRun.status 주석 참고. */
  runStatuses: { status: string; count: number }[];
  /** 이번 달(Asia/Seoul 기준) 전체 AI 지출. 사용자 한 명이 아니라 서비스 전체다. */
  ai: {
    periodLabel: string;
    costUsd: number;
    calls: number;
    /** 원가를 모르는 호출 수. 0 이 아니면 costUsd 는 실제 지출의 하한이다. */
    unknownCostCalls: number;
  };
  /**
   * 심사용 데모 계정의 이번 달 한도 현황. DEMO_EMAIL 이 없거나 그 계정이 아직
   * 로그인한 적 없으면 null.
   *
   * 이 값을 굳이 따로 보는 이유: 심사관 여럿이 계정 하나를 돌려 쓰는데(lib/auth/demo.ts)
   * AI 한도는 사용자 단위라(AiUsage.userId) 그 한 사람 몫이 심사 기간 전체의 예산이다.
   * 소진되면 그 뒤에 들어온 사람은 채팅·생성이 막힌 화면을 본다.
   */
  demoBudget: (BudgetStatus & { email: string }) | null;
  /** 최근 가입자. 누가 들어왔는지 눈으로 확인하는 용도라 길게 두지 않는다. */
  recentSignups: {
    id: string;
    email: string | null;
    githubLogin: string | null;
    createdAt: Date;
  }[];
};

const HOUR = 60 * 60 * 1000;
const RECENT_SIGNUP_LIMIT = 20;

export async function getOpsMetrics(): Promise<OpsMetrics> {
  const now = Date.now();
  const since24h = new Date(now - 24 * HOUR);
  const since7d = new Date(now - 7 * 24 * HOUR);
  const period = currentBillingPeriod();

  const [
    usersTotal,
    users24h,
    users7d,
    projectsTotal,
    projects24h,
    projects7d,
    runsTotal,
    runs24h,
    runs7d,
    runStatusRows,
    aiTotals,
    recentSignups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since24h } } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.project.count(),
    prisma.project.count({ where: { createdAt: { gte: since24h } } }),
    prisma.project.count({ where: { createdAt: { gte: since7d } } }),
    prisma.testRun.count(),
    prisma.testRun.count({ where: { createdAt: { gte: since24h } } }),
    prisma.testRun.count({ where: { createdAt: { gte: since7d } } }),
    prisma.testRun.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: period.start, lt: period.end } },
      _sum: { costUsd: true },
      // _count 에 컬럼을 주면 그 컬럼이 null 이 아닌 행을 센다. _all 과의 차이가
      // 곧 "원가를 모르는 호출 수"다 (lib/ai/usage-queries.ts 와 같은 방법).
      _count: { _all: true, costUsd: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_SIGNUP_LIMIT,
      select: { id: true, email: true, githubLogin: true, createdAt: true },
    }),
  ]);

  return {
    signups: { total: usersTotal, last24h: users24h, last7d: users7d },
    projects: { total: projectsTotal, last24h: projects24h, last7d: projects7d },
    testRuns: { total: runsTotal, last24h: runs24h, last7d: runs7d },
    runStatuses: runStatusRows
      .map((row) => ({ status: row.status, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    ai: {
      periodLabel: period.label,
      // Decimal → number. 화면에 띄우는 합계라 double 로 충분하다. 한도를 넘었는지
      // 가리는 계산은 여기 값이 아니라 budget.ts 의 Decimal 로 한다.
      costUsd: aiTotals._sum.costUsd?.toNumber() ?? 0,
      calls: aiTotals._count._all,
      unknownCostCalls: aiTotals._count._all - aiTotals._count.costUsd,
    },
    demoBudget: await demoBudget(),
    recentSignups,
  };
}

async function demoBudget(): Promise<OpsMetrics["demoBudget"]> {
  const email = process.env.DEMO_EMAIL;
  if (!email) return null;

  // public.users 는 auth.users 의 미러라, 데모 계정이 한 번도 로그인하지 않았으면
  // 행이 아직 없다(lib/auth/user.ts 의 syncUser). 그건 오류가 아니라 "아직 없음"이다.
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) return null;

  return { ...(await getMonthlyBudgetStatus(user.id)), email };
}
