import { RUNNER_REPORTS_BACK } from "@/lib/notifications/check-run";
import {
  isTerminal,
  type ComponentChange,
  type RunSummary,
  type RunStatus,
} from "@/lib/notifications/run-summary";
import type { CommentFields, NotificationSettings } from "@/lib/notifications/settings";

// PR 코멘트 본문을 만든다. 순수 함수다 — 설정 화면의 미리보기와 실제로 GitHub 에
// 쓰는 코드가 같은 함수를 부른다. 그래야 "저장하기 전에 눈으로 확인"이 거짓말이
// 되지 않는다.

/**
 * 본문 첫 줄에 넣는 보이지 않는 표식.
 *
 * sticky 코멘트를 다시 찾는 열쇠다. DB 에 캐시해 둔 commentId 가 404 면(사람이
 * 지웠다) 코멘트 목록에서 이 마커를 가진 우리 봇의 글을 찾는다. 마커를 본문
 * 안쪽이 아니라 맨 앞에 두는 이유는 잘린 응답에서도 찾을 수 있게 하려는 것이다.
 *
 * 프로젝트 ref 를 뒤에 붙인다. 같은 레포를 두 사용자가 각자 연결할 수 있는데
 * (@@unique([userId, repoId])) 마커가 같으면 서로의 코멘트를 덮어쓴다.
 * TODO(팀 PR): 소유 주체가 Team 으로 바뀌어 레포당 프로젝트가 하나가 되면
 * 접미사를 떼도 된다.
 */
export const COMMENT_MARKER = "<!-- dante:pr-summary";

export function commentMarker(projectRef: string) {
  return `${COMMENT_MARKER}:${projectRef} -->`;
}

/** 진행 중 상태의 제목 줄. 하나의 코멘트가 이 문구들을 거쳐 간다. */
const PROGRESS_LABEL: Record<Exclude<RunStatus, "completed" | "failed" | "unchanged">, string> = {
  queued: "Queued",
  scanning: "Scanning components",
  generating: "Generating tests",
  running: "Running tests",
};

export function renderPrComment(
  run: RunSummary,
  settings: NotificationSettings,
  projectRef: string
): string {
  const body = isTerminal(run.status)
    ? renderTerminal(run, settings)
    : renderProgress(run, settings);

  const links = renderLinks(run, settings.prCommentFields);

  return (
    [commentMarker(projectRef), "", body, links && `\n${links}`]
      .filter(Boolean)
      .join("\n")
      .trimEnd() + "\n"
  );
}

/**
 * 진행 중 상태.
 *
 * 러너가 결과를 되돌려주기 전까지는 "Queued" 라고 적지 않는다. 기다려도 다음
 * 단계로 넘어가지 않으니 거짓말이 되고, 같은 PR 의 체크("Not running tests yet")와도
 * 말이 어긋난다. 대신 지금 실제로 한 일 — 바뀐 컴포넌트를 찾은 것 — 까지만 적는다.
 */
function renderProgress(run: RunSummary, settings: NotificationSettings) {
  if (RUNNER_REPORTS_BACK) {
    return `### Dante — ${PROGRESS_LABEL[run.status as keyof typeof PROGRESS_LABEL]}`;
  }

  const count = run.components.length;
  // 파일 목록을 못 읽은 경우에도 여기로 온다. 그때는 몇 개인지 모른다고 적지 않고 뺀다.
  const title =
    count > 0
      ? `### Dante — found ${count} changed component${count === 1 ? "" : "s"}, not running tests yet`
      : "### Dante — not running tests yet";

  if (count === 0 || !settings.prCommentFields.components) return title;

  // 표(componentsSection)를 쓰지 않는 이유: Tests 열이 전부 0 으로 찍혀서 "테스트가
  // 없다"로 읽힌다. 아직 세지 않은 것이지 없는 게 아니다.
  const lines = run.components.map(
    (component) => `- ${inlineCode(component.name)} ${component.change}`
  );
  return [title, "", ...lines].join("\n");
}

function renderTerminal(run: RunSummary, settings: NotificationSettings) {
  if (run.status === "unchanged") {
    // 이 문구가 실제로 보이는 건 "변경 없으면 코멘트 안 달기"를 껐거나, 이미
    // 코멘트가 있는 PR 에 무변경 푸시가 온 경우다(지우지 않고 갱신만 한다).
    return "### Dante — no components changed in this push";
  }

  if (run.status === "failed") {
    return [
      "### Dante — could not finish",
      "",
      run.error ? blockquote(run.error) : "The run stopped before any tests were reported.",
    ].join("\n");
  }

  const { total, passed, failed } = run.totals;
  const green = failed === 0;
  const fields = settings.prCommentFields;

  // 통과와 실패는 글자로 가른다. 기호를 쓰면 알림 목록이나 메일 제목처럼
  // 서식이 죽는 자리에서 상태가 통째로 사라진다.
  const title = green
    ? `### Dante — all ${passed} tests passed`
    : `### Dante — ${failed} of ${total} tests failed`;

  const details = [
    summaryTable(run, fields),
    failed > 0 && fields.failedList ? failedSection(run, settings) : "",
    fields.components && run.components.length > 0 ? componentsSection(run.components) : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // 전부 통과했을 때만 접는다. 실패가 있는데 접으면 클릭하기 전까지는 무엇이
  // 깨졌는지 알 수 없어서, 코멘트를 다는 의미가 없어진다.
  if (green && settings.prCommentCollapseOnPass) {
    if (!details) return oneLine(run, fields);
    return `<details><summary>${oneLine(run, fields)}</summary>\n\n${details}\n\n</details>`;
  }

  return details ? `${title}\n\n${details}` : title;
}

/** 접었을 때 보이는 한 줄. 토글이 꺼진 조각은 빠진다. */
function oneLine(run: RunSummary, fields: CommentFields) {
  const parts = [
    fields.counts ? `${run.totals.passed} passed` : null,
    fields.components && run.components.length > 0
      ? `${run.components.length} components updated`
      : null,
    fields.duration && run.durationMs !== null ? formatDuration(run.durationMs) : null,
  ].filter(Boolean);

  return parts.length > 0 ? `Dante — ${parts.join(" · ")}` : "Dante";
}

/**
 * 제목 아래의 2열 표.
 *
 * 헤더 칸을 비워 두면 GitHub 이 머리글 없는 표로 그린다. 값을 훑어보는 표라
 * "Key | Value" 같은 머리글은 자리만 차지한다.
 */
function summaryTable(run: RunSummary, fields: CommentFields) {
  const rows: [string, string][] = [];

  if (fields.counts) {
    const { total, passed, failed } = run.totals;
    rows.push([
      "Tests",
      failed > 0
        ? `${total} total · **${passed} passed** · **${failed} failed**`
        : `${total} total · **${passed} passed**`,
    ]);
  }

  if (fields.components && run.components.length > 0) {
    rows.push(["Components", componentCounts(run.components)]);
  }

  // 수집하지 않은 실행에서는 토글과 무관하게 그리지 않는다 — 없는 값을
  // 0% 로 적으면 "커버리지가 떨어졌다"로 읽힌다.
  if (fields.coverage && run.coverage) {
    rows.push(["Coverage", formatCoverage(run.coverage)]);
  }

  if (fields.duration && run.durationMs !== null) {
    rows.push(["Duration", formatDuration(run.durationMs)]);
  }

  if (rows.length === 0) return "";

  return ["|  |  |", "| --- | --- |", ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join(
    "\n"
  );
}

function failedSection(run: RunSummary, settings: NotificationSettings) {
  const limit = settings.prCommentFailedLimit;
  const shown = run.failures.slice(0, limit);
  const rest = run.failures.length - shown.length;

  const lines = shown.map((failure) => {
    const head = `- ${inlineCode(failure.file)} › ${plainText(failure.name)}`;
    // 사유를 끄면 이름만 남는다. 사유가 없는 실패(타임아웃 등)도 같은 모양이 된다.
    if (!settings.prCommentFields.failedReason || !failure.message) return head;
    return `${head} — ${inlineCode(oneLineText(failure.message))}`;
  });

  // 전부 적으면 실패 200개짜리 PR 에서 코멘트가 스크롤 지옥이 된다.
  if (rest > 0) lines.push(`- …and ${rest} more`);

  return ["**Failed**", "", ...lines].join("\n");
}

function componentsSection(components: ComponentChange[]) {
  const rows = components.map(
    (component) => `| ${inlineCode(component.name)} | ${component.change} | ${component.tests} |`
  );

  // 컴포넌트 표는 늘 접어 둔다. 통과했을 때는 볼 일이 없고, 실패했을 때도
  // 먼저 봐야 하는 건 위의 실패 목록이다.
  return [
    "<details><summary>Components in this PR</summary>",
    "",
    "| Component | Change | Tests |",
    "| --- | --- | --- |",
    ...rows,
    "",
    "</details>",
  ].join("\n");
}

function renderLinks(run: RunSummary, fields: CommentFields) {
  const links = [
    fields.link && run.detailUrl ? `[Open in Dante](${run.detailUrl})` : null,
    fields.rerun && run.rerunUrl ? `[Re-run](${run.rerunUrl})` : null,
  ].filter(Boolean);

  return links.join(" · ");
}

function componentCounts(components: ComponentChange[]) {
  const counted = { added: 0, changed: 0, removed: 0 };
  for (const component of components) counted[component.change] += 1;

  return (["added", "changed", "removed"] as const)
    .filter((change) => counted[change] > 0)
    .map((change) => `${counted[change]} ${change}`)
    .join(" · ");
}

function formatCoverage(coverage: { base: number | null; head: number }) {
  if (coverage.base === null) return `${coverage.head}%`;

  const delta = Math.round((coverage.head - coverage.base) * 10) / 10;
  const sign = delta > 0 ? "+" : "";
  return `${coverage.base}% → ${coverage.head}% (${sign}${delta}%)`;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/**
 * 테스트 이름·경로는 사용자 코드에서 온다. 표 안에서 `|` 가 열을 쪼개고,
 * 줄바꿈은 표 자체를 끊는다.
 */
function escapeInline(value: string) {
  return oneLineText(value).replaceAll("|", "\\|");
}

/**
 * 코드 span 밖에 그대로 적는 문자열.
 *
 * `it("renders *bold* `code`")` 같은 이름이 그대로 들어오면 마크다운이 그걸
 * 서식으로 읽어서 기울임이 되거나, 짝이 안 맞는 백틱이 뒷줄까지 코드로 삼킨다.
 */
function plainText(value: string) {
  return escapeInline(value).replace(/[`*_<>[\]]/g, "\\$&");
}

function oneLineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * 인라인 코드. 값 안에 백틱이 있으면 울타리를 그보다 길게 잡는다 —
 * `` `a`b` `` 같은 이름이 코드 span 을 중간에서 끊어버리는 걸 막는다.
 */
function inlineCode(value: string) {
  const text = escapeInline(value);
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  // 백틱으로 시작·끝나면 공백을 하나씩 넣어야 울타리와 붙지 않는다.
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** 에러 원문을 한 줄로 눕혀서 인용한다. 스택 트레이스가 통째로 들어와도 코멘트를 밀지 않게. */
function blockquote(value: string) {
  return `> ${oneLineText(value)}`;
}
