import { prisma, type Prisma } from "@dante/db";
import {
  DEFAULT_COMMENT_FIELDS,
  DEFAULT_NOTIFICATION_SETTINGS,
  toNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications/settings";

// ⚠️ 서버 전용. 알림 설정과 전달 로그의 DB 쪽.
//
// 순수 값(settings.ts)과 나눠 둔 이유는 화면이 settings.ts 를 import 하기
// 때문이다. 한 파일에 두면 클라이언트 번들이 Prisma 를 끌고 들어간다.

/** 행이 없으면 기본값. 프로젝트를 만들 때 설정 행을 미리 넣지 않는다(schema 주석). */
export async function loadNotificationSettings(projectId: string): Promise<NotificationSettings> {
  const row = await prisma.projectNotificationSetting.findUnique({ where: { projectId } });
  return toNotificationSettings(row);
}

/**
 * 설정을 저장한다. 행이 없으면 만들고, 있으면 준 것만 덮어쓴다.
 *
 * create 쪽에 기본값을 다시 적는 이유: 첫 저장이 부분 저장일 수 있는데
 * (스누즈만 켜는 경우 등) Prisma 의 create 는 안 준 칸을 DB 기본값으로 채운다.
 * JSON 칸에는 DB 기본값이 없어서 여기서 넣어줘야 한다.
 */
export async function saveNotificationSettings(
  projectId: string,
  patch: Partial<NotificationSettings>
) {
  // undefined 인 칸은 아예 넣지 않는다. Prisma 는 update 에서 undefined 를
  // "건드리지 마라"로 읽지만, 그렇더라도 넣지 않는 편이 create 쪽과 모양이 같다.
  const data = {
    ...(patch.prCommentEnabled !== undefined && { prCommentEnabled: patch.prCommentEnabled }),
    ...(patch.prCommentMode !== undefined && { prCommentMode: patch.prCommentMode }),
    ...(patch.prCommentSkipUnchanged !== undefined && {
      prCommentSkipUnchanged: patch.prCommentSkipUnchanged,
    }),
    ...(patch.prCommentCollapseOnPass !== undefined && {
      prCommentCollapseOnPass: patch.prCommentCollapseOnPass,
    }),
    ...(patch.prCommentFields !== undefined && { prCommentFields: patch.prCommentFields }),
    ...(patch.prCommentFailedLimit !== undefined && {
      prCommentFailedLimit: patch.prCommentFailedLimit,
    }),
    ...(patch.checkRunEnabled !== undefined && { checkRunEnabled: patch.checkRunEnabled }),
    ...(patch.checkRunBlocking !== undefined && { checkRunBlocking: patch.checkRunBlocking }),
    ...(patch.branchFilters !== undefined && { branchFilters: patch.branchFilters }),
    ...(patch.skipDraftPr !== undefined && { skipDraftPr: patch.skipDraftPr }),
    ...(patch.snoozedUntil !== undefined && { snoozedUntil: patch.snoozedUntil }),
  } satisfies Prisma.ProjectNotificationSettingUncheckedUpdateInput;

  await prisma.projectNotificationSetting.upsert({
    where: { projectId },
    // JSON 칸에는 DB 기본값이 없다. 첫 저장이 부분 저장이어도(스누즈만 켜는 등)
    // 여기서 채워 넣어야 NOT NULL 제약에 걸리지 않는다.
    create: { projectId, ...data, prCommentFields: data.prCommentFields ?? DEFAULT_COMMENT_FIELDS },
    update: data,
  });
}

/** 전달 로그 한 줄이 가리키는 표면. Slack·Email 이 붙으면 여기에 값이 는다. */
export type DeliverySurface = "github_comment" | "github_check";

export type DeliveryStatus = "ok" | "skipped" | "failed";

/**
 * 전달 로그를 남긴다.
 *
 * 로그 쓰기가 실패해도 알림 자체를 실패로 만들지 않는다 — 기록하려다 본 일을
 * 망치는 건 순서가 뒤바뀐 것이다.
 */
export async function recordDelivery(entry: {
  projectId: string;
  surface: DeliverySurface;
  prNumber: number | null;
  status: DeliveryStatus;
  detail?: string | null;
}) {
  try {
    await prisma.notificationDelivery.create({
      data: {
        projectId: entry.projectId,
        surface: entry.surface,
        prNumber: entry.prNumber,
        status: entry.status,
        // 에러 원문이 스택 트레이스째 들어올 수 있다. 화면에서 읽을 만큼만 남긴다.
        detail: entry.detail?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error("[notifications] delivery log failed", error);
  }
}

/** 화면 §7 이 보여주는 최근 목록. */
export function recentDeliveries(projectId: string, take = 20) {
  return prisma.notificationDelivery.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * 최근 3건이 연속으로 실패했는지 (§8 배지).
 *
 * skipped 는 실패가 아니라 의도된 침묵이라 세지 않는다. 그래서 ok/failed 만
 * 추려서 본다 — 안 그러면 드래프트 PR 몇 개로 배지가 켜진다.
 */
export async function deliveriesFailing(projectId: string) {
  const recent = await prisma.notificationDelivery.findMany({
    where: { projectId, status: { in: ["ok", "failed"] } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { status: true },
  });

  return recent.length === 3 && recent.every((row) => row.status === "failed");
}

/** 보존 기간. 지난 것은 배치가 지운다. */
export const DELIVERY_RETENTION_DAYS = 30;

export function purgeOldDeliveries(now = new Date()) {
  const cutoff = new Date(now.getTime() - DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return prisma.notificationDelivery.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

/** 기본값을 화면에서 되돌릴 때 쓴다 (설정 행을 지우면 기본값으로 돌아간다). */
export async function resetNotificationSettings(projectId: string) {
  await prisma.projectNotificationSetting.deleteMany({ where: { projectId } });
  return DEFAULT_NOTIFICATION_SETTINGS;
}
