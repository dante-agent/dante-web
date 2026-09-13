// 대시보드 Usage 섹션의 활동 지표 (서버 전용).
//
// PR comments·Check runs 는 알림 전달 로그(NotificationDelivery)에서 실제로 센다.
// surface 로 둘을 가르고, status="ok"(실제로 올라간 것)를 volume 으로, "failed" 를
// 경고 카운터로 본다. "skipped" 는 의도된 침묵이라 세지 않는다(store.ts 와 같은 규칙).
//
// Test runs·Generations 는 test-metrics.ts 에서 다룬다.

import { prisma } from "@dante/db";
import { activityWindow, dayIndex, emptyBuckets, type ActivitySeries } from "./window";

export interface DeliveryActivity {
  from: string;
  to: string;
  prComments: ActivitySeries;
  checkRuns: ActivitySeries;
}

/**
 * 최근 7일의 알림 전달을 하루 단위로 버킷하여 PR comments·Check runs 두 카드를 만든다.
 * 전달 건수는 많지 않아 기간 안의 행을 통째로 읽고 JS 에서 센다 (date_trunc 원시 SQL 대신).
 */
export async function getDeliveryActivity(projectId: string): Promise<DeliveryActivity> {
  const { from, to } = activityWindow();

  const rows = await prisma.notificationDelivery.findMany({
    where: { projectId, createdAt: { gte: from } },
    select: { surface: true, status: true, createdAt: true },
  });

  const empty = () => ({ posted: emptyBuckets(), total: 0, failed: 0 });
  const buckets = {
    github_comment: empty(),
    github_check: empty(),
  };

  for (const row of rows) {
    const b = buckets[row.surface as keyof typeof buckets];
    if (!b) continue; // 미래에 slack/discord 등이 붙어도 여기선 무시
    if (row.status === "failed") {
      b.failed += 1;
    } else if (row.status === "ok") {
      b.posted[dayIndex(row.createdAt, from)] += 1;
      b.total += 1;
    }
    // "skipped" 는 세지 않는다.
  }

  const toSeries = (
    key: string,
    label: string,
    b: { posted: number[]; total: number; failed: number }
  ): ActivitySeries => ({
    key,
    label,
    total: b.total,
    failed: b.failed,
    errors: 0, // 전달에는 "error" 상태가 없다 (ok | skipped | failed)
    points: b.posted,
  });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    prComments: toSeries("pr-comments", "PR comments", buckets.github_comment),
    checkRuns: toSeries("check-runs", "Check runs", buckets.github_check),
  };
}

/** 최근 7일의 GitHub 웹훅 배달을 하루 단위로 버킷한다. */
export async function getWebhookActivity(projectId: string): Promise<ActivitySeries> {
  const { from } = activityWindow();
  const rows = await prisma.webhookDelivery.findMany({
    where: { projectId, createdAt: { gte: from } },
    select: { createdAt: true },
  });
  const points = emptyBuckets();

  for (const row of rows) points[dayIndex(row.createdAt, from)] += 1;

  return {
    key: "webhooks",
    label: "Webhooks",
    total: rows.length,
    failed: 0,
    errors: 0,
    points,
  };
}
