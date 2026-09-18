import { Writable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";
import { REPORT_PATH, type TestReport } from "./report.ts";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  accessTokenCredentials,
  cloneDirName,
  gitSource,
  joinLogs,
  keepColorCodes,
  readReport,
  type RunRequest,
  type RunResult,
} from "./run.ts";
import { collectPathAliases, toolkitFiles, toolkitInstallCommand } from "./toolkit.ts";

// 테스트 한 번을 돌리면서 진행을 실시간으로 흘려보낸다 (폴더 보기 터미널용).
//
// runTest(run.ts) 와 순서(샌드박스 → 파일 쓰기 → install → test → 리포트)는 같지만 따로 둔다.
// runTest 는 PR 자동 테스트가 쓰는 경로라 이 기능 때문에 바뀌면 안 된다.
//
// 테스트는 레포의 러너·설정이 아니라 Dante 전용 환경으로 돌린다(ADR-0003, toolkit.ts). 레포에는 소스와
// 소스가 쓰는 패키지만 있으면 된다 — 레포 install 뒤에 도구를 레포 밖에 설치하고, Dante 설정으로 실행한다.
// 그래서 req.commands.test(레포·Runtime 탭의 테스트 커맨드)는 쓰지 않는다. install 커맨드는 쓴다.
// ponytail: 흐름이 runTest 와 겹친다. 둘이 같이 바뀌기 시작하면 onEvent 를 받는 함수 하나로 합친다.

export type LiveStep = "setup" | "install" | "toolkit" | "test";

export type LiveEvent =
  | { type: "step"; step: LiveStep; state: "start" }
  | { type: "step"; step: LiveStep; state: "done"; ok: boolean; ms: number }
  /** 러너 출력 조각. 줄 단위가 아니다 — 받은 만큼 온다. ANSI 색 코드가 섞여 있다. */
  | { type: "log"; step: Exclude<LiveStep, "setup">; text: string };

export type LiveResult = RunResult & {
  /** 전체 마감을 넘겨 멈췄는지. 화면이 "시간 초과"를 따로 적는다. */
  timedOut: boolean;
};

/**
 * runTest 와 같은 결과를 돌려주면서, 단계 시작·끝과 출력 조각을 onEvent 로 알린다.
 * signal 이 끊기면(브라우저 탭을 닫음) 진행 중인 명령을 멈추고 샌드박스를 내린다.
 */
export async function runTestLive(
  req: RunRequest,
  opts: { signal?: AbortSignal; onEvent: (event: LiveEvent) => void }
): Promise<LiveResult> {
  const { signal, onEvent } = opts;
  const startedAt = new Date();
  const timeoutMs = Math.min(req.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const deadline = startedAt.getTime() + timeoutMs;
  const remainingMs = () => Math.max(1_000, deadline - Date.now());
  // 명령 타임아웃은 SIGKILL 로 끝나 종료 코드만 남는다. 마감을 넘겼는지로 시간 초과를 가린다.
  const pastDeadline = () => Date.now() >= deadline - 1_000;
  const logs: string[] = [];

  const done = (
    status: RunResult["status"],
    exitCode: number | null,
    errorMessage?: string,
    report: TestReport | null = null,
    timedOut = false
  ): LiveResult => ({
    status,
    exitCode,
    logs: joinLogs(logs),
    ...(errorMessage ? { errorMessage } : {}),
    report,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    timedOut,
  });
  const timeoutResult = (exitCode: number | null) =>
    done("error", exitCode, `Timed out after ${Math.round(timeoutMs / 1000)}s`, null, true);

  // 단계 하나를 시작·끝 이벤트로 감싼다.
  let step: { name: LiveStep; at: number } | null = null;
  const begin = (name: LiveStep) => {
    step = { name, at: Date.now() };
    onEvent({ type: "step", step: name, state: "start" });
  };
  const end = (ok: boolean) => {
    if (!step) return;
    onEvent({ type: "step", step: step.name, state: "done", ok, ms: Date.now() - step.at });
    step = null;
  };

  if (signal?.aborted) return done("error", null, "Request was aborted, so the tests did not run");

  let sandbox: Sandbox | undefined;
  try {
    begin("setup");
    sandbox = await Sandbox.create({
      source: gitSource(req.repo),
      timeout: timeoutMs + 60_000,
      resources: { vcpus: 2 },
      signal,
      ...accessTokenCredentials(),
    });
    const repoDir = `${sandbox.cwd}/${cloneDirName(req.repo.url)}`;
    await sandbox.writeFiles(
      req.testFiles.map((file) => ({ path: `${repoDir}/${file.path}`, content: file.content })),
      { signal }
    );
    end(true);

    begin("install");
    const install = await runStreaming(sandbox, {
      command: req.commands.install,
      cwd: repoDir,
      timeoutMs: remainingMs(),
      signal,
      onText: (text) => onEvent({ type: "log", step: "install", text }),
    });
    logs.push(install.section);
    end(install.exitCode === 0);
    if (install.exitCode !== 0) {
      if (pastDeadline()) return timeoutResult(null);
      return done("error", null, `Install failed (exit ${install.exitCode})`);
    }

    begin("toolkit");
    const toolkit = await runStreaming(sandbox, {
      command: toolkitInstallCommand(req.framework),
      cwd: repoDir,
      timeoutMs: remainingMs(),
      signal,
      onText: (text) => onEvent({ type: "log", step: "toolkit", text }),
    });
    logs.push(toolkit.section);
    if (toolkit.exitCode !== 0) {
      end(false);
      if (pastDeadline()) return timeoutResult(null);
      return done("error", null, `Installing Dante test tools failed (exit ${toolkit.exitCode})`);
    }
    // 레포 tsconfig 의 경로 별칭을 읽어 Dante 설정에 옮긴다. 없거나 못 읽으면 별칭 없이 돈다.
    const aliases = await collectPathAliases((path) =>
      readRepoFile(sandbox!, repoDir, path, signal)
    );
    const env = toolkitFiles({
      framework: req.framework,
      repoDir,
      aliases,
      testFiles: req.testFiles.map((file) => file.path),
      reportPath: REPORT_PATH,
    });
    await sandbox.writeFiles(env.files, { signal });
    end(true);

    begin("test");
    const test = await runStreaming(sandbox, {
      command: env.command,
      cwd: repoDir,
      timeoutMs: remainingMs(),
      signal,
      onText: (text) => onEvent({ type: "log", step: "test", text }),
    });
    logs.push(test.section);
    end(test.exitCode === 0);
    if (test.exitCode !== 0 && pastDeadline()) return timeoutResult(test.exitCode);

    const report = await readReport(sandbox, repoDir);
    if (test.exitCode === 0) return done("passed", test.exitCode, undefined, report);
    if (report === null) {
      return done(
        "error",
        test.exitCode,
        `The test runner did not produce a report (exit ${test.exitCode})`
      );
    }
    return done("failed", test.exitCode, undefined, report);
  } catch (err) {
    end(false);
    if (!signal?.aborted && pastDeadline()) return timeoutResult(null);
    return done("error", null, err instanceof Error ? err.message : String(err));
  } finally {
    await sandbox?.stop().catch(() => {});
  }
}

/**
 * 명령 하나를 돌리며 출력 조각을 onText 로 넘기고, 끝나면 로그 블록(runTest 의 section 과 같은 모양)을 만든다.
 *
 * 러너는 터미널이 아니면 색을 끈다. 화면이 색을 그리므로 FORCE_COLOR 로 켠다(리포트 JSON 파일에는 영향 없음).
 * 조각(onText)도 저장용 로그 블록도 색 코드를 남긴다. 저장된 로그도 같은 터미널 모양으로 그린다.
 * stdout 과 stderr 를 한 흐름으로 합친다 — vitest 가 둘에 걸쳐 출력해 나누면 순서가 어그러진다.
 */
async function runStreaming(
  sandbox: Sandbox,
  opts: {
    command: string;
    cwd: string;
    timeoutMs: number;
    signal?: AbortSignal;
    onText: (text: string) => void;
  }
): Promise<{ exitCode: number | null; section: string }> {
  const chunks: string[] = [];
  // 멀티바이트 글자(✓ 등)가 조각 경계에서 잘려도 깨지지 않게 스트림마다 디코더를 따로 둔다.
  const sink = () => {
    const decoder = new TextDecoder();
    return new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
        if (text) {
          chunks.push(text);
          opts.onText(text);
        }
        callback();
      },
    });
  };

  const result = await sandbox.runCommand({
    cmd: "sh",
    // env 옵션 대신 셸에서 켠다 — 기존 환경에 더하기만 한다는 게 확실하다.
    args: ["-c", `export FORCE_COLOR=1; ${opts.command}`],
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
    stdout: sink(),
    stderr: sink(),
  });
  // DB(TestRun.logs)에는 색 코드만 남긴다. 커서 이동 같은 나머지 제어 코드는 화면에서 글자로 찍힌다.
  const output = keepColorCodes(chunks.join(""));
  return {
    exitCode: result.exitCode,
    section: [`$ ${opts.command}`, output, `(exit ${result.exitCode})`].filter(Boolean).join("\n"),
  };
}

/** ANSI 이스케이프(색·커서 이동) 제거. CSI(ESC [ … 문자)와 OSC(ESC ] … BEL/ST)만 다룬다. */
export function stripAnsi(text: string): string {
  return text.replace(
    /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g,
    ""
  );
}

/** 레포 안 파일 하나를 읽는다. 없거나 못 읽으면 null. */
async function readRepoFile(
  sandbox: Sandbox,
  repoDir: string,
  path: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const result = await sandbox.runCommand({ cmd: "cat", args: [path], cwd: repoDir, signal });
    if (result.exitCode !== 0) return null;
    return await result.output("stdout");
  } catch {
    return null;
  }
}
