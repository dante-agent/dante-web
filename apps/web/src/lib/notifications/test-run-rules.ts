import { createHmac, timingSafeEqual } from "node:crypto";
import type { PullRequestContext } from "./deliver.ts";
import type { GenerationOutcome, LocatedComponent } from "./run-result.ts";

// 팀 단위 샌드박스 실행 줄(test-run-queue.ts)의 규칙. DB 도 네트워크도 부르지 않는 순수 함수다.
//
// 생성과 실행은 다른 함수(요청)에서 돈다. 생성 쪽이 넘기는 값의 모양, 죽은 실행을 가려내는 시간,
// 실행 함수를 부르는 내부 요청의 서명이 여기 있다.

/**
 * 생성이 실행에 넘기는 값. PullRequestJob.runInput 에 JSON 으로 적는다.
 *
 * 생성된 테스트 본문은 싣지 않는다. PullRequestTest 행에 이미 있다.
 */
export type RunInput = {
  pr: PullRequestContext;
  components: LocatedComponent[];
  failedFiles: string[];
  stopped: GenerationOutcome["stopped"];
};

/**
 * DB 에서 읽은 runInput. 모양이 틀리면 null.
 *
 * JSON 컬럼이라 타입이 보장되지 않는다. 틀린 값으로 코멘트를 쓰면 엉뚱한 PR·커밋에 결과가 붙는다.
 */
export function parseRunInput(value: unknown): RunInput | null {
  if (!isRecord(value)) return null;
  const { pr, components, failedFiles, stopped } = value;
  if (!isPullRequestContext(pr)) return null;
  if (!Array.isArray(components) || !components.every(isLocatedComponent)) return null;
  if (!Array.isArray(failedFiles) || !failedFiles.every((file) => typeof file === "string")) {
    return null;
  }
  if (stopped !== null && stopped !== "budget-exceeded" && stopped !== "budget-unavailable") {
    return null;
  }
  return { pr, components, failedFiles, stopped };
}

/**
 * testing 으로 남은 작업을 죽은 것으로 보는 시간.
 *
 * 실행 함수의 수명(800초)을 넘겼으면 함수는 이미 없다. 여유를 두고 15분으로 잡는다.
 * 이보다 짧으면 살아 있는 실행 옆에 같은 팀의 실행이 하나 더 뜬다.
 */
export const TEST_RUN_STALE_MS = 15 * 60 * 1000;

export function isStaleTestRun(runStartedAt: Date | null, now: Date) {
  // 시작 시각이 없으면 언제부터 막고 있었는지 모른다. 계속 막아 둘 근거가 없으니 죽은 것으로 본다.
  if (runStartedAt === null) return true;
  return now.getTime() - runStartedAt.getTime() > TEST_RUN_STALE_MS;
}

/** 내부 요청 서명의 유효 시간. 요청은 만들자마자 보내므로 짧게 둔다. */
const TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * 실행 함수(api/internal/pr-test-run)를 부를 때 붙이는 서명. `<만료 ms>.<hex>` 모양이다.
 *
 * 작업 ID 와 만료를 같이 서명해서, 새어도 다른 작업을 돌리거나 오래 재사용할 수 없다.
 */
export function signTestRunToken(secret: string, jobId: string, now: Date) {
  const expiresAt = now.getTime() + TOKEN_TTL_MS;
  return `${expiresAt}.${mac(secret, jobId, expiresAt)}`;
}

export function verifyTestRunToken(secret: string, jobId: string, token: string, now: Date) {
  const [expiresRaw, signature, extra] = token.split(".");
  if (extra !== undefined || !expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now.getTime()) return false;

  // timingSafeEqual 은 길이가 다르면 던진다. 길이 자체는 비밀이 아니라 먼저 비교해도 된다.
  const expected = Buffer.from(mac(secret, jobId, expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * 메시지 앞에 용도를 붙인다. 열쇠(GITHUB_APP_WEBHOOK_SECRET)를 웹훅 서명과 같이 쓰는데,
 * 웹훅 본문은 JSON 이라 `{` 로 시작하므로 이 메시지와 겹칠 수 없다.
 */
function mac(secret: string, jobId: string, expiresAt: number) {
  return createHmac("sha256", secret)
    .update(`dante:pr-test-run:v1:${jobId}:${expiresAt}`)
    .digest("hex");
}

function isPullRequestContext(value: unknown): value is PullRequestContext {
  if (!isRecord(value)) return false;
  const { author } = value;
  return (
    Number.isSafeInteger(value.number) &&
    typeof value.headSha === "string" &&
    typeof value.baseRef === "string" &&
    typeof value.draft === "boolean" &&
    Array.isArray(value.labels) &&
    value.labels.every((label) => typeof label === "string") &&
    (value.headCommitMessage === null || typeof value.headCommitMessage === "string") &&
    (author === null ||
      (isRecord(author) &&
        Number.isSafeInteger(author.githubId) &&
        typeof author.login === "string"))
  );
}

function isLocatedComponent(value: unknown): value is LocatedComponent {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    (value.change === "added" || value.change === "changed" || value.change === "removed") &&
    typeof value.tests === "number" &&
    typeof value.filePath === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
