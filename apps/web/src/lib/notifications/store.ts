import { prisma, type Prisma } from "@dante/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";
import {
  DEFAULT_COMMENT_FIELDS,
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
  patch: Partial<Omit<NotificationSettings, "discordWebhookSaved">>
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
    ...(patch.discordEnabled !== undefined && { discordEnabled: patch.discordEnabled }),
    ...(patch.discordEvents !== undefined && { discordEvents: patch.discordEvents }),
    ...(patch.discordLocale !== undefined && { discordLocale: patch.discordLocale }),
  } satisfies Prisma.ProjectNotificationSettingUncheckedUpdateInput;

  await prisma.projectNotificationSetting.upsert({
    where: { projectId },
    // JSON 칸에는 DB 기본값이 없다. 첫 저장이 부분 저장이어도(스누즈만 켜는 등)
    // 여기서 채워 넣어야 NOT NULL 제약에 걸리지 않는다.
    create: { projectId, ...data, prCommentFields: data.prCommentFields ?? DEFAULT_COMMENT_FIELDS },
    update: data,
  });
}

/** Discord 웹훅 URL 을 암호화해 저장한다. 설정 행이 없으면 기본값으로 만든다. */
export async function saveDiscordWebhookUrl(projectId: string, url: string) {
  const encryptedDiscordWebhookUrl = encryptSecret(url);
  await prisma.projectNotificationSetting.upsert({
    where: { projectId },
    create: { projectId, prCommentFields: DEFAULT_COMMENT_FIELDS, encryptedDiscordWebhookUrl },
    update: { encryptedDiscordWebhookUrl },
  });
}

/**
 * 저장된 웹훅 URL. 없거나 복호화가 안 되면 null.
 *
 * 복호화 실패(ENCRYPTION_KEY 를 갈았거나 값이 변조됨)는 "안 붙어 있음"과 같게 다룬다.
 * 던지면 알림 전달 전체가 멈추는데, 사용자가 할 일은 어느 쪽이든 URL 을 다시 붙이는 것이다.
 */
export async function loadDiscordWebhookUrl(projectId: string) {
  const row = await prisma.projectNotificationSetting.findUnique({
    where: { projectId },
    select: { encryptedDiscordWebhookUrl: true },
  });
  if (!row?.encryptedDiscordWebhookUrl) return null;

  try {
    return decryptSecret(row.encryptedDiscordWebhookUrl);
  } catch (error) {
    console.error("[notifications] discord webhook url could not be decrypted", error);
    return null;
  }
}

/** 전달 로그 한 줄이 가리키는 표면. Slack·Email 이 붙으면 여기에 값이 는다. */
export type DeliverySurface = "github_comment" | "github_check" | "discord";

export type DeliveryStatus = "ok" | "skipped" | "failed";

/** 보존 기간. 화면(§7)에도 이 숫자를 그대로 적는다. */
export const DELIVERY_RETENTION_DAYS = 30;

const retentionCutoff = (now = new Date()) =>
  new Date(now.getTime() - DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

/** 기록 몇 건에 한 번 옛 행을 지울지. */
const RETENTION_CLEANUP_RATE = 1 / 50;

/**
 * 전달 로그를 남긴다.
 *
 * 로그 쓰기가 실패해도 알림 자체를 실패로 만들지 않는다 — 기록하려다 본 일을
 * 망치는 건 순서가 뒤바뀐 것이다.
 *
 * 보존 기간이 지난 행은 여기서 가끔(RETENTION_CLEANUP_RATE) 같이 지운다. 크론을 따로
 * 두면 스케줄러와 시크릿이 하나씩 늘어나는데, 이 프로젝트의 행만 보는 삭제라
 * (projectId, createdAt) 인덱스로 끝난다. 매번 지우지 않는 건 쓰기 한 번을 아끼려는
 * 것이다. 옛 행이 조금 더 남아도 화면이 기간 밖을 거르므로(recentDeliveries) 보이지 않는다.
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
    if (Math.random() < RETENTION_CLEANUP_RATE) {
      await prisma.notificationDelivery.deleteMany({
        where: { projectId: entry.projectId, createdAt: { lt: retentionCutoff() } },
      });
    }
  } catch (error) {
    console.error("[notifications] delivery log failed", error);
  }
}

/** 화면 §7 이 보여주는 최근 목록. 보존 기간 안의 것만. */
export function recentDeliveries(projectId: string, take = 20) {
  return prisma.notificationDelivery.findMany({
    where: { projectId, createdAt: { gte: retentionCutoff() } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * 최근 3건이 연속으로 실패했는지 (§8 배지).
 *
 * skipped 는 실패가 아니라 의도된 침묵이라 세지 않는다. 그래서 ok/failed 만
 * 추려서 본다 — 안 그러면 드래프트 PR 몇 개로 배지가 켜진다.
 *
 * `loaded` 는 화면이 이미 읽은 recentDeliveries 결과(최신순)다. 그 안에 ok/failed 가
 * 3건 있으면 그게 곧 최근 3건이라 다시 읽지 않는다. 모자랄 때만 DB 에 묻는다.
 */
export async function deliveriesFailing(projectId: string, loaded: { status: string }[] = []) {
  const fromLoaded = loaded.filter((row) => row.status === "ok" || row.status === "failed");
  const recent =
    fromLoaded.length >= 3
      ? fromLoaded.slice(0, 3)
      : await prisma.notificationDelivery.findMany({
          where: { projectId, status: { in: ["ok", "failed"] } },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { status: true },
        });

  return recent.length === 3 && recent.every((row) => row.status === "failed");
}
