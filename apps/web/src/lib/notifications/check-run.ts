import type { DiscordLocale } from "@/lib/notifications/discord";
import { isTerminal, type RunSummary } from "@/lib/notifications/run-summary";
import type { NotificationSettings } from "@/lib/notifications/settings";

// Check Run 쪽. 코멘트와 목적이 다르다.
//
//   코멘트   읽는 것 — 사람이 훑는 요약. 길어도 되고 접을 수 있다
//   Check    판정하는 것 — 머지를 막을 수 있다. 짧은 제목 + summary 뿐이다
//
// 코멘트만 있으면 실패해도 머지되고, Check 만 있으면 왜 실패했는지 알기 어렵다.
// 그래서 둘 다 만든다.

/** GitHub 이 받는 이름. 레포의 required check 목록에 이 문자열이 들어간다. */
export const CHECK_RUN_NAME = "dante";

/**
 * 러너가 결과를 되돌려주는가.
 *
 * PR 작업(pull-request-job.ts)이 생성·실행 단계마다 `deliverRunSummary` 를 부르고,
 * 끝나면 결론을 채운다. 그래서 중간 상태를 in_progress 로 내보낸다.
 *
 * 전제: 끝나지 않은 상태(queued 등)를 넘기는 쪽은 반드시 뒤에 결론을 이어서 보내야 한다.
 * 그렇지 않으면 체크가 영원히 돈다.
 */
export const RUNNER_REPORTS_BACK = true;

/**
 * 체크에 들어가는 문장 전부. 언어는 PR 코멘트와 같은 설정(prCommentLocale)을 따른다 —
 * 같은 PR 화면 안에서 코멘트는 한국어, 체크는 영어로 섞여 보이지 않게.
 *
 * 테스트 이름·파일 경로·건너뛴 사유·Dante 오류 문장은 번역하지 않는다(comment.ts 와 같다).
 */
const COPY: Record<
  DiscordLocale,
  {
    notRunningYet: string;
    foundComponents: (count: number) => string;
    notRunningYetSummary: string;
    running: string;
    runningSummary: string;
    unchanged: string;
    unchangedSummary: string;
    skippedGeneration: string;
    skippedGenerationSummary: string;
    couldNotFinish: string;
    stoppedEarly: string;
    passed: (count: number) => string;
    allPassed: (total: number) => string;
    failed: (count: number) => string;
    someFailed: (failed: number, total: number) => string;
    more: (rest: number) => string;
    timedOut: string;
    timedOutSummary: string;
    skipped: string;
  }
> = {
  en: {
    notRunningYet: "Not running tests yet",
    foundComponents: (count) => `Found ${count} changed component${count === 1 ? "" : "s"}. `,
    notRunningYetSummary:
      "Dante does not generate or run tests yet. This check will report a real result once the runner lands.",
    running: "Running",
    runningSummary: "Dante is scanning components and running the generated tests.",
    unchanged: "No components changed",
    unchangedSummary: "Nothing in this pull request touches a component Dante tracks.",
    skippedGeneration: "Skipped test generation",
    skippedGenerationSummary: "Dante skipped test generation for this pull request.",
    couldNotFinish: "Could not finish",
    stoppedEarly: "The run stopped before any tests were reported.",
    passed: (count) => `${count} passed`,
    allPassed: (total) => `All ${total} tests passed.`,
    failed: (count) => `${count} failed`,
    someFailed: (failed, total) => `${failed} of ${total} tests failed.`,
    more: (rest) => `…and ${rest} more`,
    timedOut: "Timed out",
    timedOutSummary: "The runner did not report back in time. Re-run to try again.",
    skipped: "Skipped",
  },
  ko: {
    notRunningYet: "아직 테스트를 돌리지 않습니다",
    foundComponents: (count) => `바뀐 컴포넌트 ${count}개를 찾았습니다. `,
    notRunningYetSummary:
      "Dante 는 아직 테스트를 만들거나 돌리지 않습니다. 러너가 붙으면 이 체크가 실제 결과를 알려줍니다.",
    running: "실행 중",
    runningSummary: "Dante 가 컴포넌트를 찾고 만든 테스트를 돌리는 중입니다.",
    unchanged: "바뀐 컴포넌트 없음",
    unchangedSummary: "이 PR 은 Dante 가 추적하는 컴포넌트를 건드리지 않습니다.",
    skippedGeneration: "테스트 생성 건너뜀",
    skippedGenerationSummary: "Dante 가 이 PR 의 테스트 생성을 건너뛰었습니다.",
    couldNotFinish: "실행을 끝내지 못함",
    stoppedEarly: "테스트 결과가 나오기 전에 실행이 멈췄습니다.",
    passed: (count) => `${count}개 통과`,
    allPassed: (total) => `테스트 ${total}개 모두 통과했습니다.`,
    failed: (count) => `${count}개 실패`,
    someFailed: (failed, total) => `테스트 ${total}개 중 ${failed}개가 실패했습니다.`,
    more: (rest) => `…외 ${rest}개`,
    timedOut: "시간 초과",
    timedOutSummary: "러너가 제때 답하지 않았습니다. 다시 실행해 보세요.",
    skipped: "건너뜀",
  },
};

type Copy = (typeof COPY)[DiscordLocale];

export type CheckConclusion = "success" | "failure" | "neutral" | "skipped" | "cancelled";

export type CheckRunResult = {
  /** 아직 안 끝났으면 in_progress 로 만들어 두고 나중에 결론을 채운다. */
  status: "in_progress" | "completed";
  conclusion: CheckConclusion | null;
  title: string;
  summary: string;
};

/**
 * 실행 결과 → 체크의 결론.
 *
 * 핵심은 `checkRunBlocking` 하나다. 켜면 실패를 `failure` 로 보고하고, 끄면
 * `neutral` 로 보고한다 — neutral 은 required check 로 걸려 있어도 머지를 막지
 * 않는다. 우리가 머지를 직접 막는 게 아니라는 점이 중요하다. 실제 차단은 레포의
 * branch protection 에서 `dante` 를 required 로 추가해야 동작하고, 그게 없으면
 * 이 토글을 켜도 아무 일도 일어나지 않는다(화면에서 그 사실을 같이 알린다).
 */
export function checkRunResult(run: RunSummary, settings: NotificationSettings): CheckRunResult {
  const copy = COPY[settings.prCommentLocale];

  if (!isTerminal(run.status)) {
    // 끝나지 않은 체크는 누군가 결론을 채워줄 때만 만들어도 된다. 지금은 스캔·
    // 생성·실행이 없어서 그 "누군가"가 없다 — in_progress 로 두면 PR 마다
    // 스피너가 영원히 돌고, `dante` 를 required check 로 걸어둔 레포에서는
    // 테스트가 깨져서가 아니라 끝나지 않아서 머지가 막힌다.
    //
    // 그래서 파이프라인이 붙기 전까지는 바로 닫는다. neutral 이라 required 로
    // 걸려 있어도 아무것도 막지 않고, 자리는 잡아둔다.
    if (!RUNNER_REPORTS_BACK) {
      const count = run.components.length;
      const found = count > 0 ? copy.foundComponents(count) : "";
      return {
        status: "completed",
        conclusion: "neutral",
        title: copy.notRunningYet,
        summary: `${found}${copy.notRunningYetSummary}`,
      };
    }

    return {
      status: "in_progress",
      conclusion: null,
      title: copy.running,
      summary: copy.runningSummary,
    };
  }

  if (run.status === "unchanged") {
    return {
      status: "completed",
      conclusion: "neutral",
      title: copy.unchanged,
      summary: copy.unchangedSummary,
    };
  }

  if (run.status === "skipped") {
    // 테스트가 깨진 게 아니라 돌리지 않은 것이다. required check 여도 머지를 막지 않는다.
    return {
      status: "completed",
      conclusion: "neutral",
      title: copy.skippedGeneration,
      summary: run.skipReason ?? copy.skippedGenerationSummary,
    };
  }

  if (run.status === "failed") {
    // 우리 쪽이 못 끝낸 것이지 테스트가 깨진 게 아니다. 그래도 blocking 을 켠
    // 팀에게는 "결과를 모른다"가 통과보다 위험하므로 같은 규칙을 적용한다.
    return {
      status: "completed",
      conclusion: settings.checkRunBlocking ? "failure" : "neutral",
      title: copy.couldNotFinish,
      summary: run.error ?? copy.stoppedEarly,
    };
  }

  const { total, passed, failed } = run.totals;

  if (failed === 0) {
    return {
      status: "completed",
      conclusion: "success",
      title: copy.passed(passed),
      summary: copy.allPassed(total),
    };
  }

  return {
    status: "completed",
    conclusion: settings.checkRunBlocking ? "failure" : "neutral",
    title: copy.failed(failed),
    // summary 는 Checks 탭에서 제목 아래 한 덩어리로 보인다. 실패한 이름 몇 개만
    // 적고 나머지는 코멘트로 보내는 편이 읽기 쉽다.
    summary: failureSummary(run, copy),
  };
}

/** 러너가 시간 안에 답을 안 준 경우. 실패와 구분해야 재실행할지 판단할 수 있다. */
export function timedOutCheckRun(locale: DiscordLocale): CheckRunResult {
  return {
    status: "completed",
    conclusion: "cancelled",
    title: COPY[locale].timedOut,
    summary: COPY[locale].timedOutSummary,
  };
}

/** 브랜치 필터·드래프트·스누즈로 건너뛴 경우. 실패로 보이면 안 된다. */
export function skippedCheckRun(reason: string, locale: DiscordLocale): CheckRunResult {
  return {
    status: "completed",
    conclusion: "skipped",
    title: COPY[locale].skipped,
    summary: reason,
  };
}

const SUMMARY_FAILURE_LIMIT = 5;

function failureSummary(run: RunSummary, copy: Copy) {
  const shown = run.failures.slice(0, SUMMARY_FAILURE_LIMIT);
  const rest = run.failures.length - shown.length;

  const lines = shown.map((failure) => `- ${failure.file} › ${failure.name}`);
  if (rest > 0) lines.push(`- ${copy.more(rest)}`);

  return [copy.someFailed(run.totals.failed, run.totals.total), "", ...lines].join("\n");
}
