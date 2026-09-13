// pull_request_jobs.run_result(JSON) → 화면이 쓰는 모양. 순수 함수다.
//
// DB 의 JSON 은 타입이 없다. runner 응답 모양이 바뀌었거나 옛 행이면 필드가 빠질 수 있어서,
// 화면에서 그대로 캐스팅하지 않고 여기서 한 번 거른다. 못 읽는 필드는 비운다.

export type StoredRun = {
  status: "passed" | "failed" | "error";
  errorMessage: string | null;
  totals: { total: number; passed: number; failed: number } | null;
  failures: { file: string; name: string; message: string | null }[];
  /** 테스트 파일 경로 → 그 파일의 테스트 수 */
  testsByFile: Map<string, { total: number; failed: number }>;
  durationMs: number | null;
};

export function readStoredRun(value: unknown): StoredRun | null {
  if (!isRecord(value)) return null;
  const status = value.status;
  if (status !== "passed" && status !== "failed" && status !== "error") return null;

  const report = isRecord(value.report) ? value.report : null;
  const totals = report && isRecord(report.totals) ? report.totals : null;

  const failures = (report && Array.isArray(report.failures) ? report.failures : [])
    .filter(isRecord)
    .map((failure) => ({
      file: String(failure.file ?? ""),
      name: String(failure.name ?? ""),
      message: typeof failure.message === "string" ? failure.message : null,
    }));

  const testsByFile = new Map<string, { total: number; failed: number }>();
  for (const file of report && Array.isArray(report.files) ? report.files : []) {
    if (!isRecord(file) || typeof file.file !== "string") continue;
    testsByFile.set(file.file, { total: toCount(file.total), failed: toCount(file.failed) });
  }

  const started = typeof value.startedAt === "string" ? Date.parse(value.startedAt) : NaN;
  const finished = typeof value.finishedAt === "string" ? Date.parse(value.finishedAt) : NaN;

  return {
    status,
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : null,
    totals: totals
      ? {
          total: toCount(totals.total),
          passed: toCount(totals.passed),
          failed: toCount(totals.failed),
        }
      : null,
    failures,
    testsByFile,
    durationMs: Number.isFinite(finished - started) ? Math.max(0, finished - started) : null,
  };
}

function toCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
