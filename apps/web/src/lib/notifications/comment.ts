import { RUNNER_REPORTS_BACK } from "./check-run.ts";
import type { NotificationLocale } from "./locale.ts";
import {
  isTerminal,
  type ComponentChange,
  type RunSummary,
  type RunStatus,
} from "./run-summary.ts";
import type { CommentFields, NotificationSettings } from "./settings.ts";

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
 * 예전에는 뒤에 프로젝트 ref 를 붙였다(`<!-- dante:pr-summary:<ref> -->`). 같은 레포를
 * 여러 프로젝트가 연결할 수 있던 때라 서로의 코멘트를 덮어쓰지 않으려고. 레포당
 * 프로젝트가 하나가 되면서(@@unique([repoId])) 뗐다.
 */
export const COMMENT_MARKER = "<!-- dante:pr-summary -->";

/**
 * 옛 마커와 새 마커가 함께 갖는 앞부분. 찾을 때는 이걸 본다.
 * 이미 열려 있는 PR 에는 옛 마커 코멘트가 달려 있다. 새 마커로만 찾으면 그 PR 에
 * 코멘트가 하나 더 생긴다.
 */
export const COMMENT_MARKER_PREFIX = "<!-- dante:pr-summary";

type ProgressStatus = Exclude<RunStatus, "completed" | "failed" | "unchanged" | "skipped">;
type Change = ComponentChange["change"];

/**
 * 코멘트에 들어가는 문장 전부. 모양과 까닭은 Discord 와 같다(discord.ts 의 COPY).
 *
 * 테스트 이름·파일 경로·실패 사유·Dante 오류 문장(run.error, skipReason)은 번역하지
 * 않는다. 원문이어야 검색해서 답을 찾을 수 있다.
 */
const COPY: Record<
  NotificationLocale,
  {
    /** 진행 중 상태의 제목 줄. 하나의 코멘트가 이 문구들을 거쳐 간다. */
    progress: Record<ProgressStatus, string>;
    foundComponents: (count: number) => string;
    notRunningYet: string;
    unchanged: string;
    skipped: string;
    skippedDefault: string;
    couldNotFinish: string;
    stoppedEarly: string;
    allPassed: (passed: number) => string;
    someFailed: (failed: number, total: number) => string;
    passed: (count: number) => string;
    failed: (count: number) => string;
    total: (count: number) => string;
    componentsUpdated: (count: number) => string;
    tests: string;
    components: string;
    coverage: string;
    duration: string;
    failedHeading: string;
    more: (rest: number) => string;
    componentsInPr: string;
    component: string;
    change: string;
    changeLabel: Record<Change, string>;
    /** 요약 표의 "2 added · 1 changed" 한 조각. 한국어는 숫자가 뒤에 와야 읽힌다. */
    changeCount: (count: number, change: string) => string;
    openInDante: string;
    rerun: string;
  }
> = {
  en: {
    progress: {
      queued: "Queued",
      scanning: "Scanning components",
      generating: "Generating tests",
      running: "Running tests",
    },
    foundComponents: (count) =>
      `found ${count} changed component${count === 1 ? "" : "s"}, not running tests yet`,
    notRunningYet: "not running tests yet",
    unchanged: "no components changed in this push",
    skipped: "skipped test generation",
    skippedDefault: "Dante skipped test generation for this pull request.",
    couldNotFinish: "could not finish",
    stoppedEarly: "The run stopped before any tests were reported.",
    allPassed: (passed) => `all ${passed} tests passed`,
    someFailed: (failed, total) => `${failed} of ${total} tests failed`,
    passed: (count) => `${count} passed`,
    failed: (count) => `${count} failed`,
    total: (count) => `${count} total`,
    componentsUpdated: (count) => `${count} components updated`,
    tests: "Tests",
    components: "Components",
    coverage: "Coverage",
    duration: "Duration",
    failedHeading: "Failed",
    more: (rest) => `…and ${rest} more`,
    componentsInPr: "Components in this PR",
    component: "Component",
    change: "Change",
    changeLabel: { added: "added", changed: "changed", removed: "removed" },
    changeCount: (count, change) => `${count} ${change}`,
    openInDante: "Open in Dante",
    rerun: "Re-run",
  },
  ko: {
    progress: {
      queued: "대기 중",
      scanning: "컴포넌트 찾는 중",
      generating: "테스트 만드는 중",
      running: "테스트 실행 중",
    },
    foundComponents: (count) =>
      `바뀐 컴포넌트 ${count}개를 찾았습니다. 아직 테스트는 돌리지 않습니다`,
    notRunningYet: "아직 테스트는 돌리지 않습니다",
    unchanged: "이번 푸시에서 바뀐 컴포넌트가 없습니다",
    skipped: "테스트 생성을 건너뛰었습니다",
    skippedDefault: "Dante 가 이 PR 의 테스트 생성을 건너뛰었습니다.",
    couldNotFinish: "실행을 끝내지 못했습니다",
    stoppedEarly: "테스트 결과가 나오기 전에 실행이 멈췄습니다.",
    allPassed: (passed) => `테스트 ${passed}개 모두 통과`,
    someFailed: (failed, total) => `테스트 ${total}개 중 ${failed}개 실패`,
    passed: (count) => `${count}개 통과`,
    failed: (count) => `${count}개 실패`,
    total: (count) => `전체 ${count}개`,
    componentsUpdated: (count) => `컴포넌트 ${count}개 갱신`,
    tests: "테스트",
    components: "컴포넌트",
    coverage: "커버리지",
    duration: "소요 시간",
    failedHeading: "실패",
    more: (rest) => `…외 ${rest}개`,
    componentsInPr: "이 PR 의 컴포넌트",
    component: "컴포넌트",
    change: "변경",
    changeLabel: { added: "추가", changed: "변경", removed: "삭제" },
    changeCount: (count, change) => `${change} ${count}개`,
    openInDante: "Dante 에서 보기",
    rerun: "다시 실행",
  },
};

type Copy = (typeof COPY)[NotificationLocale];

export function renderPrComment(run: RunSummary, settings: NotificationSettings): string {
  const copy = COPY[settings.prCommentLocale];
  const body = isTerminal(run.status)
    ? renderTerminal(run, settings, copy)
    : renderProgress(run, settings, copy);

  const links = renderLinks(run, settings.prCommentFields, copy);

  return (
    [COMMENT_MARKER, "", body, links && `\n${links}`].filter(Boolean).join("\n").trimEnd() + "\n"
  );
}

/**
 * 진행 중 상태.
 *
 * 러너가 결과를 되돌려주기 전까지는 "Queued" 라고 적지 않는다. 기다려도 다음
 * 단계로 넘어가지 않으니 거짓말이 되고, 같은 PR 의 체크("Not running tests yet")와도
 * 말이 어긋난다. 대신 지금 실제로 한 일 — 바뀐 컴포넌트를 찾은 것 — 까지만 적는다.
 */
function renderProgress(run: RunSummary, settings: NotificationSettings, copy: Copy) {
  if (RUNNER_REPORTS_BACK) {
    return `### Dante — ${copy.progress[run.status as ProgressStatus]}`;
  }

  const count = run.components.length;
  // 파일 목록을 못 읽은 경우에도 여기로 온다. 그때는 몇 개인지 모른다고 적지 않고 뺀다.
  const title =
    count > 0 ? `### Dante — ${copy.foundComponents(count)}` : `### Dante — ${copy.notRunningYet}`;

  if (count === 0 || !settings.prCommentFields.components) return title;

  // 표(componentsSection)를 쓰지 않는 이유: Tests 열이 전부 0 으로 찍혀서 "테스트가
  // 없다"로 읽힌다. 아직 세지 않은 것이지 없는 게 아니다.
  const lines = run.components.map(
    (component) => `- ${inlineCode(component.name)} ${copy.changeLabel[component.change]}`
  );
  return [title, "", ...lines].join("\n");
}

function renderTerminal(run: RunSummary, settings: NotificationSettings, copy: Copy) {
  if (run.status === "unchanged") {
    // 이 문구가 실제로 보이는 건 "변경 없으면 코멘트 안 달기"를 껐거나, 이미
    // 코멘트가 있는 PR 에 무변경 푸시가 온 경우다(지우지 않고 갱신만 한다).
    return `### Dante — ${copy.unchanged}`;
  }

  if (run.status === "skipped") {
    // 왜 안 했는지를 한 줄로 적는다. 코멘트가 없으면 "Dante 가 고장났나"로 읽힌다.
    return [
      `### Dante — ${copy.skipped}`,
      "",
      blockquote(run.skipReason ?? copy.skippedDefault),
    ].join("\n");
  }

  if (run.status === "failed") {
    return [
      `### Dante — ${copy.couldNotFinish}`,
      "",
      run.error ? blockquote(run.error) : copy.stoppedEarly,
    ].join("\n");
  }

  const { total, passed, failed } = run.totals;
  const green = failed === 0;
  const fields = settings.prCommentFields;

  // 통과와 실패는 글자로 가른다. 기호를 쓰면 알림 목록이나 메일 제목처럼
  // 서식이 죽는 자리에서 상태가 통째로 사라진다.
  const title = green
    ? `### Dante — ${copy.allPassed(passed)}`
    : `### Dante — ${copy.someFailed(failed, total)}`;

  const details = [
    summaryTable(run, fields, copy),
    failed > 0 && fields.failedList ? failedSection(run, settings, copy) : "",
    fields.components && run.components.length > 0 ? componentsSection(run.components, copy) : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // 전부 통과했을 때만 접는다. 실패가 있는데 접으면 클릭하기 전까지는 무엇이
  // 깨졌는지 알 수 없어서, 코멘트를 다는 의미가 없어진다.
  if (green && settings.prCommentCollapseOnPass) {
    if (!details) return oneLine(run, fields, copy);
    return `<details><summary>${oneLine(run, fields, copy)}</summary>\n\n${details}\n\n</details>`;
  }

  return details ? `${title}\n\n${details}` : title;
}

/** 접었을 때 보이는 한 줄. 토글이 꺼진 조각은 빠진다. */
function oneLine(run: RunSummary, fields: CommentFields, copy: Copy) {
  const parts = [
    fields.counts ? copy.passed(run.totals.passed) : null,
    fields.components && run.components.length > 0
      ? copy.componentsUpdated(run.components.length)
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
function summaryTable(run: RunSummary, fields: CommentFields, copy: Copy) {
  const rows: [string, string][] = [];

  if (fields.counts) {
    const { total, passed, failed } = run.totals;
    rows.push([
      copy.tests,
      failed > 0
        ? `${copy.total(total)} · **${copy.passed(passed)}** · **${copy.failed(failed)}**`
        : `${copy.total(total)} · **${copy.passed(passed)}**`,
    ]);
  }

  if (fields.components && run.components.length > 0) {
    rows.push([copy.components, componentCounts(run.components, copy)]);
  }

  // 수집하지 않은 실행에서는 토글과 무관하게 그리지 않는다 — 없는 값을
  // 0% 로 적으면 "커버리지가 떨어졌다"로 읽힌다.
  if (fields.coverage && run.coverage) {
    rows.push([copy.coverage, formatCoverage(run.coverage)]);
  }

  if (fields.duration && run.durationMs !== null) {
    rows.push([copy.duration, formatDuration(run.durationMs)]);
  }

  if (rows.length === 0) return "";

  return ["|  |  |", "| --- | --- |", ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join(
    "\n"
  );
}

function failedSection(run: RunSummary, settings: NotificationSettings, copy: Copy) {
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
  if (rest > 0) lines.push(`- ${copy.more(rest)}`);

  return [`**${copy.failedHeading}**`, "", ...lines].join("\n");
}

function componentsSection(components: ComponentChange[], copy: Copy) {
  const rows = components.map(
    (component) =>
      `| ${inlineCode(component.name)} | ${copy.changeLabel[component.change]} | ${component.tests} |`
  );

  // 컴포넌트 표는 늘 접어 둔다. 통과했을 때는 볼 일이 없고, 실패했을 때도
  // 먼저 봐야 하는 건 위의 실패 목록이다.
  return [
    `<details><summary>${copy.componentsInPr}</summary>`,
    "",
    `| ${copy.component} | ${copy.change} | ${copy.tests} |`,
    "| --- | --- | --- |",
    ...rows,
    "",
    "</details>",
  ].join("\n");
}

function renderLinks(run: RunSummary, fields: CommentFields, copy: Copy) {
  const links = [
    fields.link && run.detailUrl ? `[${copy.openInDante}](${run.detailUrl})` : null,
    fields.rerun && run.rerunUrl ? `[${copy.rerun}](${run.rerunUrl})` : null,
  ].filter(Boolean);

  return links.join(" · ");
}

function componentCounts(components: ComponentChange[], copy: Copy) {
  const counted = { added: 0, changed: 0, removed: 0 };
  for (const component of components) counted[component.change] += 1;

  return (["added", "changed", "removed"] as const)
    .filter((change) => counted[change] > 0)
    .map((change) => copy.changeCount(counted[change], copy.changeLabel[change]))
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
