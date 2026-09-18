import type { ProjectNotificationSetting } from "@dante/db";
import {
  DEFAULT_DISCORD_EVENTS,
  parseDiscordEvents,
  parseDiscordLocale,
  type DiscordEvents,
  type DiscordLocale,
} from "@/lib/notifications/discord";

// 알림 설정값의 모양과 기본값. 서버·클라이언트 양쪽에서 읽으므로 여기에는
// DB 도 GitHub 도 부르지 않는 순수 값만 둔다 (화면이 이 파일을 import 한다).
//
// DB 행이 없을 수 있다는 게 이 파일의 존재 이유다. 프로젝트를 만들 때 설정 행을
// 미리 넣지 않기 때문에(기본값을 바꾸면 기존 행을 전부 손봐야 한다) "행 없음"을
// 늘 기본값으로 접어야 하고, 그 접는 자리가 여기다.

/** PR 코멘트에 무엇을 적을지. DB 에는 JSON 한 칸으로 들어간다. */
export type CommentFieldId =
  /** 전체 / 성공 / 실패 수 */
  | "counts"
  /** 실패한 테스트 목록 */
  | "failedList"
  /** 실패 사유(assertion 메시지). failedList 가 꺼지면 같이 묻힌다 */
  | "failedReason"
  /** 변경된 컴포넌트 표 */
  | "components"
  /** base 브랜치 대비 커버리지 델타 */
  | "coverage"
  /** 소요 시간 */
  | "duration"
  /** 단테 딥링크 */
  | "link"
  /** Re-run 링크 */
  | "rerun";

export type CommentFields = Record<CommentFieldId, boolean>;

/** 설정 화면이 그대로 훑어 쓰는 목록. 순서 = 화면에 보이는 순서. */
export const COMMENT_FIELDS: {
  id: CommentFieldId;
  label: string;
  hint?: string;
}[] = [
  { id: "counts", label: "Test counts", hint: "Turn off and only the title line stays" },
  { id: "failedList", label: "Failed tests" },
  { id: "failedReason", label: "Failure reason", hint: "The assertion message, not just the name" },
  { id: "components", label: "Changed components" },
  { id: "coverage", label: "Coverage delta", hint: "Only shown when coverage was collected" },
  { id: "duration", label: "Duration" },
  { id: "link", label: "Link to Dante" },
  { id: "rerun", label: "Re-run link" },
];

/**
 * 커버리지만 기본이 꺼져 있다. 커버리지 수집을 켜지 않은 프로젝트에서는 값이
 * 없어서 어차피 안 그려지는데, 토글이 켜져 있으면 "왜 안 나오지"가 된다.
 */
export const DEFAULT_COMMENT_FIELDS: CommentFields = {
  counts: true,
  failedList: true,
  failedReason: true,
  components: true,
  coverage: false,
  duration: true,
  link: true,
  rerun: true,
};

/**
 * 프리셋 둘.
 *
 * 토글이 8개면 화면이 지저분하고, 대부분은 "짧게" 또는 "다 보여줘" 중 하나를
 * 원한다. 그래서 프리셋을 위에 두고 개별 토글은 Customize 안으로 접는다.
 */
export const COMMENT_PRESETS: Record<"compact" | "detailed", CommentFields> = {
  /** 제목 + 수치 + 실패 이름 + 돌아올 링크. PR 대화 탭을 짧게 유지한다. */
  compact: {
    counts: true,
    failedList: true,
    failedReason: false,
    components: false,
    coverage: false,
    duration: false,
    link: true,
    rerun: false,
  },
  /**
   * 기본값과 같다. 한 번도 건드리지 않은 프로젝트가 "Custom" 으로 보이면 안 되기
   * 때문이다 — 손댄 적 없는데 손댄 것처럼 읽힌다.
   *
   * 그래서 커버리지는 여기에도 빠져 있고, 켜려면 Customize 로 들어가야 한다.
   * 커버리지를 수집하는 프로젝트가 아직 소수라 프리셋에 넣을 자리가 아니다.
   */
  detailed: DEFAULT_COMMENT_FIELDS,
};

export type CommentPreset = keyof typeof COMMENT_PRESETS | "custom";

/** 지금 토글 조합이 어느 프리셋인지. 어느 쪽도 아니면 "custom". */
export function commentPresetOf(fields: CommentFields): CommentPreset {
  for (const [name, preset] of Object.entries(COMMENT_PRESETS)) {
    if (COMMENT_FIELDS.every((field) => preset[field.id] === fields[field.id])) {
      return name as CommentPreset;
    }
  }
  return "custom";
}

/**
 * Slack 으로 보낼 결과 (docs/notifications-slack.md §4).
 *
 * 진행 상태(queued·generating…)는 목록에 없다. Slack 은 사람을 방해하는 표면이라
 * 결론만 보낸다 — 진행 상태까지 밀면 PR 하나가 사람을 네 번 부른다.
 */
export type SlackEventId =
  /** 테스트가 하나라도 실패 */
  | "failed"
  /** 직전에 실패했던 PR 이 전부 통과 */
  | "recovered"
  /** 전부 통과 (복구가 아닌 경우) */
  | "passed"
  /** 우리 쪽이 끝내지 못함 */
  | "cannotFinish";

export type SlackEvents = Record<SlackEventId, boolean>;

/** 설정 화면이 그대로 훑어 쓰는 목록. 순서 = 화면에 보이는 순서. */
export const SLACK_EVENTS: { id: SlackEventId; label: string; hint?: string }[] = [
  { id: "failed", label: "Tests failed", hint: "The reason to connect Slack at all" },
  {
    id: "recovered",
    label: "Fixed after failing",
    hint: "So nobody keeps watching a pull request that's already green",
  },
  {
    id: "passed",
    label: "All tests passed",
    hint: "Off by default — on a busy repo this posts dozens of times a day",
  },
  { id: "cannotFinish", label: "Dante couldn't finish", hint: "A problem on our side" },
];

/** 통과만 끈다. 켜 두면 하루에 수십 번 울리고, 그 팀은 채널을 음소거한다. */
export const DEFAULT_SLACK_EVENTS: SlackEvents = {
  failed: true,
  recovered: true,
  passed: false,
  cannotFinish: true,
};

/** parseCommentFields 와 같은 규칙. 없는 키는 기본값, 모르는 키는 버린다. */
export function parseSlackEvents(value: unknown): SlackEvents {
  const stored =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const events = { ...DEFAULT_SLACK_EVENTS };
  for (const event of SLACK_EVENTS) {
    const saved = stored[event.id];
    if (typeof saved === "boolean") events[event.id] = saved;
  }
  return events;
}

/** "sticky" = 코멘트 하나를 계속 고쳐 쓴다. "append" = 푸시마다 새 코멘트. */
export type PrCommentMode = "sticky" | "append";

export type NotificationSettings = {
  prCommentEnabled: boolean;
  prCommentMode: PrCommentMode;
  prCommentSkipUnchanged: boolean;
  prCommentCollapseOnPass: boolean;
  prCommentFields: CommentFields;
  prCommentFailedLimit: number;
  prCommentLocale: DiscordLocale;
  checkRunEnabled: boolean;
  checkRunBlocking: boolean;
  branchFilters: string[];
  skipDraftPr: boolean;
  snoozedUntil: Date | null;
  discordEnabled: boolean;
  discordEvents: DiscordEvents;
  discordLocale: DiscordLocale;
  /**
   * 웹훅 URL 이 저장돼 있는지만. 이 값은 화면(클라이언트)으로 가므로 URL 자체는
   * 싣지 않는다 — URL 을 가진 사람은 그 채널에 글을 쓸 수 있다. URL 은 store.ts 가 따로 읽는다.
   */
  discordWebhookSaved: boolean;
  slackEnabled: boolean;
  slackChannelId: string | null;
  slackChannelName: string | null;
  slackEvents: SlackEvents;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  prCommentEnabled: true,
  prCommentMode: "sticky",
  prCommentSkipUnchanged: true,
  prCommentCollapseOnPass: true,
  prCommentFields: DEFAULT_COMMENT_FIELDS,
  prCommentFailedLimit: 10,
  prCommentLocale: "en",
  checkRunEnabled: true,
  checkRunBlocking: false,
  branchFilters: [],
  skipDraftPr: true,
  snoozedUntil: null,
  discordEnabled: false,
  discordEvents: DEFAULT_DISCORD_EVENTS,
  discordLocale: "en",
  discordWebhookSaved: false,
  slackEnabled: false,
  slackChannelId: null,
  slackChannelName: null,
  slackEvents: DEFAULT_SLACK_EVENTS,
};

/** 실패 목록에 적을 개수의 범위. 0 이면 목록 토글을 끄는 것과 같아 1부터 받는다. */
export const FAILED_LIMIT_MIN = 1;
export const FAILED_LIMIT_MAX = 50;

export function clampFailedLimit(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_NOTIFICATION_SETTINGS.prCommentFailedLimit;
  return Math.min(FAILED_LIMIT_MAX, Math.max(FAILED_LIMIT_MIN, Math.trunc(value)));
}

/**
 * JSON 칸을 타입 있는 값으로 좁힌다.
 *
 * 토글을 늘리거나 이름을 바꾸면 예전에 저장된 JSON 에는 없는 키가 생긴다.
 * 없는 키는 기본값으로 채우고 모르는 키는 버린다 — 그래야 항목을 늘릴 때
 * 마이그레이션이 필요 없다는 JSON 의 이점이 실제로 성립한다.
 */
export function parseCommentFields(value: unknown): CommentFields {
  const stored =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const fields = { ...DEFAULT_COMMENT_FIELDS };
  for (const field of COMMENT_FIELDS) {
    const saved = stored[field.id];
    if (typeof saved === "boolean") fields[field.id] = saved;
  }
  return fields;
}

/** DB 행(또는 없음)을 화면·렌더러가 쓰는 한 모양으로 접는다. */
export function toNotificationSettings(
  row: ProjectNotificationSetting | null
): NotificationSettings {
  if (!row) return DEFAULT_NOTIFICATION_SETTINGS;

  return {
    prCommentEnabled: row.prCommentEnabled,
    // 문자열 칸이라 무엇이든 들어올 수 있다. 모르는 값은 기본 동작(sticky)으로 —
    // 코멘트가 쌓이는 쪽보다 덮어쓰는 쪽이 되돌리기 쉽다.
    prCommentMode: row.prCommentMode === "append" ? "append" : "sticky",
    prCommentSkipUnchanged: row.prCommentSkipUnchanged,
    prCommentCollapseOnPass: row.prCommentCollapseOnPass,
    prCommentFields: parseCommentFields(row.prCommentFields),
    prCommentFailedLimit: clampFailedLimit(row.prCommentFailedLimit),
    prCommentLocale: parseDiscordLocale(row.prCommentLocale),
    checkRunEnabled: row.checkRunEnabled,
    checkRunBlocking: row.checkRunBlocking,
    branchFilters: row.branchFilters,
    skipDraftPr: row.skipDraftPr,
    snoozedUntil: row.snoozedUntil,
    discordEnabled: row.discordEnabled,
    discordEvents: parseDiscordEvents(row.discordEvents),
    discordLocale: parseDiscordLocale(row.discordLocale),
    discordWebhookSaved: row.encryptedDiscordWebhookUrl !== null,
    slackEnabled: row.slackEnabled,
    slackChannelId: row.slackChannelId,
    slackChannelName: row.slackChannelName,
    slackEvents: parseSlackEvents(row.slackEvents),
  };
}

/** 스누즈가 아직 유효한지. 지난 시각이 남아 있으면 스누즈가 아니다. */
export function isSnoozed(settings: NotificationSettings, now = new Date()) {
  return settings.snoozedUntil !== null && settings.snoozedUntil.getTime() > now.getTime();
}
