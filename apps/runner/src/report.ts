// 테스트 러너의 JSON 리포트 → 테스트별 결과. 순수 함수다.
//
// 종료 코드만으로는 "몇 개 중 몇 개가, 무엇이 왜" 실패했는지 알 수 없다. PR 코멘트가
// 그걸 적어야 해서 러너에게 JSON 리포트를 파일로 쓰게 하고 그 파일을 읽는다.
//
// vitest 의 json 리포터는 jest 의 --json 과 같은 모양을 쓴다. 그래서 파서는 하나다.
//   { testResults: [{ name, status, message, assertionResults: [{ fullName, status, failureMessages }] }] }

export type TestFramework = "vitest" | "jest";

export type FailedTest = {
  /** 레포 루트 기준 경로 */
  file: string;
  /** describe › it 를 이어 붙인 이름 */
  name: string;
  /** 실패 메시지 첫 줄. 없을 수 있다 */
  message: string | null;
};

export type TestReport = {
  /** skipped·todo 는 세지 않는다. 코멘트가 "N 개 중 M 개 실패" 로 읽히는 숫자다 */
  totals: { total: number; passed: number; failed: number };
  failures: FailedTest[];
};

/** 샌드박스 안에서 리포트를 쓸 자리. 레포 밖에 둬서 사용자 파일과 섞이지 않게 한다. */
export const REPORT_PATH = "/tmp/dante-report.json";

/**
 * 프로젝트의 테스트 커맨드에 "이 파일들만, JSON 리포트도 같이" 를 덧붙인다.
 *
 * 파일을 넘기는 이유: preview 는 방금 만든 테스트만 돌리는 것이다. 안 넘기면 레포의
 * 테스트 전체가 돌아 느리고, 기존 테스트의 실패가 결과에 섞인다.
 *
 * 전제: 커맨드가 뒤에 붙는 인자를 러너에 그대로 넘겨야 한다. `pnpm vitest run`
 * (Runtime 탭 기본값) 은 되고, `npm test` 는 `npm test --` 로 적어야 한다.
 */
export function buildTestCommand(base: string, framework: TestFramework, files: string[]) {
  const paths = files.map(shellQuote).join(" ");
  const reporter =
    framework === "jest"
      ? `--json --outputFile=${REPORT_PATH}`
      : // default 를 같이 켜야 로그에 사람이 읽는 출력이 남는다.
        `--reporter=default --reporter=json --outputFile.json=${REPORT_PATH}`;
  return `${base} ${paths} ${reporter}`;
}

/**
 * 리포트 원문 → 결과. 읽을 수 없는 모양이면 null 이다.
 *
 * null 을 "0 개 통과"로 접지 않는 이유: 리포트가 없다는 건 러너가 리포트를 쓰기 전에
 * 죽었다는 뜻이고, 그걸 0/0 으로 적으면 코멘트가 "모두 통과"로 읽힌다.
 */
export function parseReport(raw: string, repoDir: string): TestReport | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data.testResults)) return null;

  let passed = 0;
  let failed = 0;
  const failures: FailedTest[] = [];

  for (const suite of data.testResults) {
    if (!isRecord(suite)) continue;
    const file = relativePath(typeof suite.name === "string" ? suite.name : "", repoDir);
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];

    // 파일 자체가 깨진 경우(import 에러, 문법 에러). 테스트가 하나도 안 돌았으니
    // assertion 이 비어 있다. 이걸 안 세면 "0 of 0 failed" 가 되어 실패가 사라진다.
    if (assertions.length === 0 && suite.status === "failed") {
      failed += 1;
      failures.push({ file, name: "(file failed to run)", message: firstLine(suite.message) });
      continue;
    }

    for (const assertion of assertions) {
      if (!isRecord(assertion)) continue;
      if (assertion.status === "passed") {
        passed += 1;
      } else if (assertion.status === "failed") {
        failed += 1;
        const messages = Array.isArray(assertion.failureMessages) ? assertion.failureMessages : [];
        failures.push({
          file,
          name: testName(assertion),
          message: firstLine(messages[0]),
        });
      }
    }
  }

  return { totals: { total: passed + failed, passed, failed }, failures };
}

function testName(assertion: Record<string, unknown>) {
  if (typeof assertion.fullName === "string" && assertion.fullName) return assertion.fullName;
  const ancestors = Array.isArray(assertion.ancestorTitles) ? assertion.ancestorTitles : [];
  return [...ancestors, assertion.title].filter((part) => typeof part === "string").join(" › ");
}

/** 러너는 절대경로를 적는다. 코멘트에는 레포 기준 경로로 보여준다. */
function relativePath(path: string, repoDir: string) {
  const prefix = repoDir.endsWith("/") ? repoDir : `${repoDir}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** 스택 트레이스·색 코드를 걷어낸 첫 줄. 코멘트 한 줄에 들어갈 만큼만. */
function firstLine(value: unknown) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const plain = value.replace(/\[[0-9;]*m/g, "");
  const line = plain
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  return line.length > 300 ? `${line.slice(0, 297)}...` : line;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
