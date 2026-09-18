"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@dante/db";
import { requesterLabel, requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { invalidateRepoLookups } from "@/lib/github/lookup-cache";
import {
  errorDetail,
  fetchHeadCommitMessage,
  fetchPullRequest,
  installationClient,
} from "@/lib/github/pull-request";
import type { PullRequestContext } from "@/lib/notifications/deliver";
import {
  DISCORD_EVENTS,
  isDiscordWebhookUrl,
  parseDiscordLocale,
  renderDiscordMessage,
} from "@/lib/notifications/discord";
import { discordErrorDetail, postDiscordMessage } from "@/lib/notifications/discord-send";
import { SAMPLE_RUNS } from "@/lib/notifications/run-summary";
import { enqueuePullRequestJob } from "@/lib/notifications/pull-request-job";
import {
  clampFailedLimit,
  COMMENT_FIELDS,
  type CommentFields,
  type NotificationSettings,
} from "@/lib/notifications/settings";
import {
  loadDiscordWebhookUrl,
  loadNotificationSettings,
  recordDelivery,
  saveDiscordWebhookUrl,
  saveNotificationSettings,
} from "@/lib/notifications/store";

// 알림 설정 화면이 부르는 서버 액션들.
//
// 폼 값은 전부 문자열로 온다. 여기서 한 번 좁히고 나면 아래(store → 렌더러)는
// 타입 있는 값만 본다 — 체크박스가 "on" 인지 "true" 인지 같은 사정이 렌더러까지
// 새어 들어가지 않게.

export type SaveState = { error?: string; saved?: boolean } | null;

/** 프로젝트 소유 검사. 설정은 프로젝트에 붙으므로 매번 확인해야 한다. */
async function requireProject(projectRef: string) {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: {
      id: true,
      ref: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
      // 재시도가 PR 작업을 다시 돌린다(pull-request-job.ts 의 JobProject).
      teamId: true,
      testFramework: true,
      installCommand: true,
      testCommand: true,
      testTimeoutMs: true,
    },
  });

  if (!project) throw new Error("Project not found.");
  return project;
}

const settingsPath = (ref: string) => `/project/${ref}/settings/notifications`;

/** 체크박스는 켜졌을 때만 폼에 실린다. 없으면 꺼진 것이다. */
const checked = (formData: FormData, name: string) => formData.get(name) !== null;

/**
 * GitHub 섹션 저장 (코멘트 + Check Run).
 *
 * 적용 범위(브랜치·드래프트·스누즈)는 다른 폼이다. 한 폼에 다 넣으면 스누즈를
 * 켜려다 코멘트 토글까지 같이 저장되는데, 그 둘은 고치는 이유가 다르다.
 */
export async function saveGithubNotifications(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const projectRef = String(formData.get("projectRef") ?? "");

  let project;
  try {
    project = await requireProject(projectRef);
  } catch {
    return { error: "Project not found." };
  }

  const fields = {} as CommentFields;
  for (const field of COMMENT_FIELDS) fields[field.id] = checked(formData, `field.${field.id}`);

  const patch: Partial<NotificationSettings> = {
    prCommentEnabled: checked(formData, "prCommentEnabled"),
    prCommentMode: formData.get("prCommentMode") === "append" ? "append" : "sticky",
    prCommentSkipUnchanged: checked(formData, "prCommentSkipUnchanged"),
    prCommentCollapseOnPass: checked(formData, "prCommentCollapseOnPass"),
    prCommentFields: fields,
    prCommentFailedLimit: clampFailedLimit(Number(formData.get("prCommentFailedLimit"))),
    prCommentLocale: parseDiscordLocale(formData.get("prCommentLocale")),
    checkRunEnabled: checked(formData, "checkRunEnabled"),
    checkRunBlocking: checked(formData, "checkRunBlocking"),
  };

  await saveNotificationSettings(project.id, patch);
  // "머지 차단"을 켜는 사람은 대개 막 GitHub 에서 룰셋을 걸고 온 참이다.
  // required check 상태를 캐시된 옛 값이 아니라 지금 값으로 보여준다.
  invalidateRepoLookups(project.ref);
  revalidatePath(settingsPath(project.ref));
  return { saved: true };
}

/** 적용 범위 저장 (브랜치 필터 + 드래프트 제외). */
export async function saveNotificationScope(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const projectRef = String(formData.get("projectRef") ?? "");

  let project;
  try {
    project = await requireProject(projectRef);
  } catch {
    return { error: "Project not found." };
  }

  // 줄 단위로 받는다. 쉼표로 받으면 브랜치 이름에 쉼표가 들어가는 경우를
  // 설명해야 하는데, 줄바꿈은 그런 애매함이 없다.
  const branchFilters = String(formData.get("branchFilters") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  await saveNotificationSettings(project.id, {
    branchFilters,
    skipDraftPr: checked(formData, "skipDraftPr"),
  });

  revalidatePath(settingsPath(project.ref));
  return { saved: true };
}

/**
 * 폼에 붙여 넣은 웹훅 URL. 비었으면 null(저장된 것을 그대로 쓴다), 모양이 틀리면 error.
 *
 * 저장된 URL 은 화면에 되돌려 보내지 않으므로 입력칸은 늘 비어서 온다 — 빈 칸을
 * "지우기"로 읽으면 다른 토글만 바꿔 저장해도 연결이 끊긴다.
 */
function pastedWebhookUrl(formData: FormData): { url: string | null } | { error: string } {
  const url = String(formData.get("discordWebhookUrl") ?? "").trim();
  if (!url) return { url: null };
  if (!isDiscordWebhookUrl(url)) {
    return { error: "That is not a Discord webhook URL. Copy it from Integrations → Webhooks." };
  }
  return { url };
}

/** Discord 섹션 저장 (켜기 + 웹훅 URL + 보낼 이벤트). */
export async function saveDiscordNotifications(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  let project;
  try {
    project = await requireProject(String(formData.get("projectRef") ?? ""));
  } catch {
    return { error: "Project not found." };
  }

  const pasted = pastedWebhookUrl(formData);
  if ("error" in pasted) return pasted;

  const enabled = checked(formData, "discordEnabled");
  if (pasted.url) {
    await saveDiscordWebhookUrl(project.id, pasted.url);
  } else if (enabled && !(await loadNotificationSettings(project.id)).discordWebhookSaved) {
    return { error: "Paste a webhook URL before turning Discord on." };
  }

  const events = Object.fromEntries(
    DISCORD_EVENTS.map((event) => [event.id, checked(formData, `discordEvent.${event.id}`)])
  ) as NotificationSettings["discordEvents"];

  await saveNotificationSettings(project.id, {
    discordEnabled: enabled,
    discordEvents: events,
    discordLocale: parseDiscordLocale(formData.get("discordLocale")),
  });
  revalidatePath(settingsPath(project.ref));
  return { saved: true };
}

export type DiscordTestState = { error?: string; sent?: boolean } | null;

/**
 * 테스트 알림 한 건 (docs/notifications-slack.md §9).
 *
 * GitHub 과 달리 진짜로 보낸다. 확인할 것이 문구가 아니라 "이 채널에 실제로 도착하는가"라서다.
 * 붙여 넣고 아직 저장하지 않은 URL 이 있으면 그걸로 보낸다 — 저장 전에 맞는 채널인지 보려는 것이다.
 * 결과는 화면에 바로 띄우고, 전달 로그에도 PR 없이 한 줄 남긴다.
 */
export async function sendDiscordTest(
  _prev: DiscordTestState,
  formData: FormData
): Promise<DiscordTestState> {
  let project;
  try {
    project = await requireProject(String(formData.get("projectRef") ?? ""));
  } catch {
    return { error: "Project not found." };
  }

  const pasted = pastedWebhookUrl(formData);
  if ("error" in pasted) return pasted;

  const webhookUrl = pasted.url ?? (await loadDiscordWebhookUrl(project.id));
  if (!webhookUrl) return { error: "Paste a webhook URL first." };

  const settings = await loadNotificationSettings(project.id);
  const content = renderDiscordMessage(SAMPLE_RUNS.failing, {
    repo: `${project.repoOwner}/${project.repoName}`,
    prNumber: null,
    prUrl: null,
    failedLimit: settings.prCommentFailedLimit,
    // 저장 전에 고른 언어로 보낸다. 어떻게 보이는지 보려고 누르는 버튼이다.
    locale: parseDiscordLocale(formData.get("discordLocale") ?? settings.discordLocale),
    test: true,
  });

  try {
    await postDiscordMessage(webhookUrl, content);
  } catch (error) {
    const detail = discordErrorDetail(error);
    await recordDelivery({
      projectId: project.id,
      surface: "discord",
      prNumber: null,
      status: "failed",
      detail: `test — ${detail}`,
    });
    revalidatePath(settingsPath(project.ref));
    return { error: detail };
  }

  await recordDelivery({
    projectId: project.id,
    surface: "discord",
    prNumber: null,
    status: "ok",
    detail: "test notification",
  });
  revalidatePath(settingsPath(project.ref));
  return { sent: true };
}

/** 길이가 고정된 선택지. "오늘"과 "해제할 때까지"는 아래에서 따로 계산한다. */
const SNOOZE_DURATIONS: Record<string, number | undefined> = {
  "1h": 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

/**
 * 브라우저가 실어 보낸 `getTimezoneOffset()` (분, UTC − 현지 — 한국은 -540).
 * 없거나 범위 밖이면 0(UTC)으로 둔다.
 */
function tzOffset(formData: FormData) {
  const value = Number(formData.get("tzOffset"));
  return Number.isInteger(value) && Math.abs(value) <= 14 * 60 ? value : 0;
}

/** 사용자 시계로 "오늘"이 끝나는 순간. 사용자 시계로 옮겨 그날의 끝을 잡고 UTC 로 되돌린다. */
function endOfLocalDay(now: Date, offsetMinutes: number) {
  const local = new Date(now.getTime() - offsetMinutes * 60_000);
  local.setUTCHours(23, 59, 59, 999);
  return new Date(local.getTime() + offsetMinutes * 60_000);
}

/**
 * 스누즈를 켜거나 끈다.
 *
 * "해제할 때까지"는 아주 먼 시각을 넣는다. null 을 "무기한"으로 쓰면 "스누즈
 * 아님"과 구분이 안 되고, 별도 boolean 을 두면 두 값이 어긋날 수 있다.
 *
 * "오늘"은 서버 시계로 자정을 잡으면 안 된다. 서버는 UTC 라 한국에서는 오전
 * 9시에 풀린다 — 그래서 폼이 브라우저의 시간대 차이를 같이 보낸다.
 */
export async function setSnooze(formData: FormData) {
  const projectRef = String(formData.get("projectRef") ?? "");
  const project = await requireProject(projectRef);

  const duration = String(formData.get("duration") ?? "");

  let snoozedUntil: Date | null = null;
  if (duration === "off") {
    snoozedUntil = null;
  } else if (duration === "today") {
    snoozedUntil = endOfLocalDay(new Date(), tzOffset(formData));
  } else if (duration === "forever") {
    snoozedUntil = new Date("2999-12-31T23:59:59.000Z");
  } else {
    const ms = SNOOZE_DURATIONS[duration];
    if (!ms) return;
    snoozedUntil = new Date(Date.now() + ms);
  }

  await saveNotificationSettings(project.id, { snoozedUntil });
  revalidatePath(settingsPath(project.ref));
}

/**
 * 전달 로그의 재시도 버튼.
 *
 * 그때의 결과를 다시 보내는 게 아니라 지금 상태로 다시 만든다 — 옛 결과를
 * 되살리면 이미 고쳐진 실패가 PR 에 다시 올라간다.
 *
 * 재시도하는 PR 은 대개 이미 한 번 실패한 것이라, 그사이 PR 이 지워졌거나 설치가
 * 끊겼을 수 있다. 서버 액션에서 던지면 화면 전체가 에러 페이지로 바뀌므로
 * deliverRunSummary 와 같은 규칙을 따른다 — 던지지 않고 전달 로그에 적는다.
 */
export async function retryDelivery(formData: FormData) {
  const projectRef = String(formData.get("projectRef") ?? "");
  const prNumber = Number(formData.get("prNumber"));
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) return;

  const project = await requireProject(projectRef);
  const repo = { owner: project.repoOwner, repo: project.repoName };

  let pr: PullRequestContext;
  try {
    const octokit = await installationClient(project.installationId);
    const fetched = await fetchPullRequest(octokit, repo, prNumber);
    pr = {
      ...fetched,
      headCommitMessage: await fetchHeadCommitMessage(octokit, repo, fetched.headSha),
    };
  } catch (error) {
    await recordDelivery({
      projectId: project.id,
      surface: "github_comment",
      prNumber,
      status: "failed",
      detail: errorDetail(error),
    });
    revalidatePath(settingsPath(project.ref));
    return;
  }

  // queued 를 바로 보내지 않고 작업을 다시 돌린다. 체크가 in_progress 로 나가는데
  // 결론을 채워줄 작업이 없으면 그 체크는 영원히 돈다.
  // 비용은 PR 작성자가 아니라 재시도를 누른 사람 한도로 센다(pr-author-rules.ts 의 Payer).
  // TODO(지권): 전달 로그의 재시도 버튼을 실제로 눌러 누른 사람 한도로 도는지 검증한다.
  // #129 에서 이 경로는 타입 검사까지만 했다.
  const user = await requireUser();
  await enqueuePullRequestJob(project, pr, {
    kind: "dante-requester",
    userId: user.id,
    login: requesterLabel(user),
  });

  revalidatePath(settingsPath(project.ref));
}
