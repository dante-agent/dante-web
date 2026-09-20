import { formatUsd } from "../ai/usage-format.ts";
import type { OpsMetrics } from "./metrics.ts";

// Discord 로 보낼 운영 요약을 글자로 만든다. 순수 함수 — 실제로 보내는 쪽은
// app/api/internal/ops-digest/route.ts.
//
// 렌더와 전송을 나눈 이유는 lib/notifications/discord.ts 와 같다. "왜 이런 문장이
// 왔지"의 답이 여기서 나오고, 여기만 테스트하면 Discord 없이도 확인할 수 있다.
//
// import 가 "@/" 가 아니라 확장자까지 붙인 상대 경로인 것도 그 파일들과 같은 이유다.
// `node --test` 는 tsconfig 의 "@/" 별칭을 읽지 못하고, Node 의 ESM 해석기는 확장자를
// 채워주지 않는다 — 값으로 가져오는 것은 둘 다 만족해야 한다(tsconfig 의
// allowImportingTsExtensions 가 켜져 있다). formatUsd 를 여기서 다시 짜지 않는 이유는
// usage-format.ts 맨 위에 적혀 있다: 금액 표기가 화면마다 갈리면 안 된다.
// (usage-format.ts 는 prisma 를 끌고 오지 않는다. 그쪽 import 는 타입뿐이다.)

/** Discord 메시지 본문 상한. discord.ts 의 CONTENT_LIMIT 과 같은 값이다. */
const CONTENT_LIMIT = 2000;

/** 이 비율을 넘으면 예산 줄을 경고로 바꾼다. /ops 화면의 막대와 같은 기준. */
const TIGHT_RATIO = 0.8;

/**
 * 한 번에 보내는 현황 요약.
 *
 * 임계치를 넘을 때만 울리는 경보가 아니라 주기적인 요약인 이유: "넘었나"를 한 번만
 * 알리려면 이미 알렸는지를 어딘가에 적어 둬야 하고, 그러자고 표를 하나 만들면
 * 알림 하나 때문에 마이그레이션과 RLS 가 따라온다. 요약은 상태가 필요 없고,
 * 답해야 하는 질문("지금 몇 명 들어왔나")에도 더 곧장 답한다.
 */
export function renderOpsDigest(metrics: OpsMetrics, opsUrl: string | null): string {
  const lines = ["**dante · ops**"];

  lines.push(
    `Signups **${count(metrics.signups.total)}** (+${count(metrics.signups.last24h)} today)`,
    `Projects **${count(metrics.projects.total)}** (+${count(metrics.projects.last24h)} today)`,
    `Test runs **${count(metrics.testRuns.total)}** (+${count(metrics.testRuns.last24h)} today)`
  );

  const errored = metrics.runStatuses.find((row) => row.status === "error")?.count ?? 0;
  // error 는 테스트가 떨어진 게 아니라 실행 자체가 안 된 것이다(TestRun.status 주석).
  // 우리가 볼 거리라 0 이 아닐 때만, 따로 적는다.
  if (errored > 0) lines.push(`-# ${count(errored)} run(s) could not finish`);

  lines.push("", `AI spend **${formatUsd(metrics.ai.costUsd)}** · ${metrics.ai.periodLabel}`);

  const demo = demoLine(metrics.demoBudget);
  if (demo) lines.push(demo);

  if (opsUrl) lines.push("", `[Open ops](<${opsUrl}>)`);

  const content = lines.join("\n");
  // 넘칠 일이 거의 없는 길이지만, 넘치면 Discord 가 메시지 전체를 거절한다 —
  // 잘린 요약이 안 온 요약보다 낫다.
  return content.length <= CONTENT_LIMIT ? content : `${content.slice(0, CONTENT_LIMIT - 1)}…`;
}

/**
 * 데모 계정 예산 줄. 심사관 여럿이 계정 하나를 나눠 쓰므로 이게 차면 그 뒤에 들어온
 * 사람은 AI 가 막힌 화면을 본다 — 요약에서 가장 먼저 보고 싶은 값이다.
 */
function demoLine(budget: OpsMetrics["demoBudget"]): string | null {
  if (!budget) return null;

  // 한도가 0 이면 AI 가 꺼져 있다는 뜻이다(budget.ts). 0 으로 나누지 않고 그대로 말한다.
  if (budget.limitUsd <= 0) return "Demo budget **off** (limit is 0)";

  const percent = Math.min(100, Math.round((budget.usedUsd / budget.limitUsd) * 100));
  const line = `Demo budget **${formatUsd(budget.usedUsd)} / ${formatUsd(budget.limitUsd)}** (${percent}%)`;

  if (budget.exceeded) return `${line} — **exhausted, AI is blocked for that account**`;
  if (budget.usedUsd / budget.limitUsd >= TIGHT_RATIO) return `${line} — running out`;
  return line;
}

function count(value: number) {
  return value.toLocaleString("en-US");
}
