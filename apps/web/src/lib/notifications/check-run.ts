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
 * 스캔·테스트 생성·실행이 붙고 그 콜백이 `deliverRunSummary` 를 부르게 되면
 * true 로 바꾼다. 그때부터 중간 상태가 in_progress 로 나가고, 끝나면 같은
 * 체크에 결론이 채워진다. 그 전에는 끝나지 않는 체크를 만들지 않는다.
 */
const RUNNER_REPORTS_BACK = false;

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
  if (!isTerminal(run.status)) {
    // 끝나지 않은 체크는 누군가 결론을 채워줄 때만 만들어도 된다. 지금은 스캔·
    // 생성·실행이 없어서 그 "누군가"가 없다 — in_progress 로 두면 PR 마다
    // 스피너가 영원히 돌고, `dante` 를 required check 로 걸어둔 레포에서는
    // 테스트가 깨져서가 아니라 끝나지 않아서 머지가 막힌다.
    //
    // 그래서 파이프라인이 붙기 전까지는 바로 닫는다. neutral 이라 required 로
    // 걸려 있어도 아무것도 막지 않고, 자리는 잡아둔다.
    if (!RUNNER_REPORTS_BACK) {
      return {
        status: "completed",
        conclusion: "neutral",
        title: "Not running tests yet",
        summary:
          "Dante recorded this pull request but does not run tests yet. This check will report a real result once the runner lands.",
      };
    }

    return {
      status: "in_progress",
      conclusion: null,
      title: "Running",
      summary: "Dante is scanning components and running the generated tests.",
    };
  }

  if (run.status === "unchanged") {
    return {
      status: "completed",
      conclusion: "neutral",
      title: "No components changed",
      summary: "Nothing in this pull request touches a component Dante tracks.",
    };
  }

  if (run.status === "failed") {
    // 우리 쪽이 못 끝낸 것이지 테스트가 깨진 게 아니다. 그래도 blocking 을 켠
    // 팀에게는 "결과를 모른다"가 통과보다 위험하므로 같은 규칙을 적용한다.
    return {
      status: "completed",
      conclusion: settings.checkRunBlocking ? "failure" : "neutral",
      title: "Could not finish",
      summary: run.error ?? "The run stopped before any tests were reported.",
    };
  }

  const { total, passed, failed } = run.totals;

  if (failed === 0) {
    return {
      status: "completed",
      conclusion: "success",
      title: `${passed} passed`,
      summary: `All ${total} tests passed.`,
    };
  }

  return {
    status: "completed",
    conclusion: settings.checkRunBlocking ? "failure" : "neutral",
    title: `${failed} failed`,
    // summary 는 Checks 탭에서 제목 아래 한 덩어리로 보인다. 실패한 이름 몇 개만
    // 적고 나머지는 코멘트로 보내는 편이 읽기 쉽다.
    summary: failureSummary(run),
  };
}

/** 러너가 시간 안에 답을 안 준 경우. 실패와 구분해야 재실행할지 판단할 수 있다. */
export function timedOutCheckRun(): CheckRunResult {
  return {
    status: "completed",
    conclusion: "cancelled",
    title: "Timed out",
    summary: "The runner did not report back in time. Re-run to try again.",
  };
}

/** 브랜치 필터·드래프트·스누즈로 건너뛴 경우. 실패로 보이면 안 된다. */
export function skippedCheckRun(reason: string): CheckRunResult {
  return {
    status: "completed",
    conclusion: "skipped",
    title: "Skipped",
    summary: reason,
  };
}

const SUMMARY_FAILURE_LIMIT = 5;

function failureSummary(run: RunSummary) {
  const shown = run.failures.slice(0, SUMMARY_FAILURE_LIMIT);
  const rest = run.failures.length - shown.length;

  const lines = shown.map((failure) => `- ${failure.file} › ${failure.name}`);
  if (rest > 0) lines.push(`- …and ${rest} more`);

  return [`${run.totals.failed} of ${run.totals.total} tests failed.`, "", ...lines].join("\n");
}
