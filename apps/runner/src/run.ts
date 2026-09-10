import { Sandbox, type CommandFinished } from "@vercel/sandbox";

// 테스트 한 번을 격리된 환경에서 돌린다 (실행 환경 결정은 docs/adr/0001-test-runtime.md).
//
// 이 파일은 DB 를 모른다. 무엇을 돌릴지는 전부 요청으로 받고, 결과만 돌려준다.
// AGENTS.md 의 "DB 접근은 전부 Next.js 서버에서" 를 지키기도 하고, ADR-0001 이
// 전제한 "샌드박스 제공자를 갈아끼워도 web 은 그대로" 라는 경계를 얇게 유지하려는
// 것이기도 하다. 여기서 Prisma 를 부르기 시작하면 그 경계가 무너진다.

/** 기본 상한. Vercel Sandbox 자체의 기본 타임아웃도 5분이다. */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 15 * 60 * 1000;

/** 로그 상한. TestRun.logs 는 TEXT 라 무제한이지만, 화면에 붙일 것이고 DB 도 붙는다. */
const MAX_LOG_CHARS = 200_000;

export interface RunRequest {
  repo: {
    /** https 클론 URL. 예: "https://github.com/acme/web.git" */
    url: string;
    /** 커밋 SHA·브랜치·태그. 생략하면 기본 브랜치. */
    revision?: string;
    /**
     * GitHub 설치 토큰. private 레포를 클론하려면 있어야 한다.
     *
     * runner 가 직접 발급하지 않는 이유: 발급에는 GitHub App private key 가
     * 필요한데, 그걸 여기 두면 유출 면적이 프로세스 하나만큼 늘어난다.
     * web 이 1시간짜리로 받아서 넘겨주고, 우리는 쓰고 버린다.
     */
    token?: string;
  };
  /** 레포 위에 덮어쓸 테스트 파일. 커밋되지 않은 버전을 돌리기 위한 것이다. */
  testFile: {
    /** 레포 루트 기준 경로. 예: "src/components/Button.test.tsx" */
    path: string;
    content: string;
  };
  /** 프로젝트 설정(Runtime 탭)에서 오는 값. 지금은 web 이 기본값을 채워 보낸다. */
  commands: {
    /** 예: "pnpm install --frozen-lockfile" */
    install: string;
    /** 예: "pnpm vitest run" */
    test: string;
  };
  /** 밀리초. 생략하면 5분, 최대 15분. */
  timeoutMs?: number;
}

export interface RunResult {
  /**
   * "passed" | "failed" | "error" — TestRun.status 와 같은 값을 쓴다.
   *
   * failed 와 error 를 나누는 게 이 함수의 핵심이다. 테스트가 돌고 떨어진 것과
   * 애초에 못 돈 것은 사용자가 할 일이 다르다. install 이 깨졌는데 "테스트 실패"
   * 라고 보여주면 사용자는 자기 테스트 코드를 들여다보며 시간을 버린다.
   */
  status: "passed" | "failed" | "error";
  /** 테스트 프로세스의 종료 코드. 실행조차 못 했으면 null. */
  exitCode: number | null;
  logs: string;
  /** status 가 "error" 일 때만. 화면에 한 줄로 띄울 사유. */
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
}

export async function runTest(req: RunRequest): Promise<RunResult> {
  const startedAt = new Date();
  const timeoutMs = Math.min(req.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const logs: string[] = [];

  const done = (
    status: RunResult["status"],
    exitCode: number | null,
    errorMessage?: string
  ): RunResult => ({
    status,
    exitCode,
    logs: joinLogs(logs),
    ...(errorMessage ? { errorMessage } : {}),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  });

  let sandbox: Sandbox | undefined;
  try {
    sandbox = await Sandbox.create({
      source: gitSource(req.repo),
      // 샌드박스 자체의 수명. 아래 명령별 timeoutMs 보다 넉넉해야 명령 타임아웃이
      // 먼저 걸리고, "설치가 오래 걸렸다" 처럼 원인이 남는다. 샌드박스가 먼저
      // 죽으면 로그도 같이 사라진다.
      timeout: timeoutMs + 60_000,
      resources: { vcpus: 2 },
    });

    // 클론은 세션 기본 경로(/vercel) 바로 아래가 아니라 그 안의 레포 이름 폴더로
    // 들어간다. 명령도 파일 쓰기도 기본 경로 기준이라, 여기를 잡아주지 않으면
    // 레포 밖에서 install 하고 레포 밖에 테스트 파일을 쓴다.
    const repoDir = `${sandbox.cwd}/${cloneDirName(req.repo.url)}`;

    // 아직 커밋되지 않은 버전을 돌리는 게 목적이라 항상 덮어쓴다.
    await sandbox.writeFiles([
      { path: `${repoDir}/${req.testFile.path}`, content: req.testFile.content },
    ]);

    const install = await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", req.commands.install],
      cwd: repoDir,
      timeoutMs,
    });
    logs.push(await section(req.commands.install, install));
    if (install.exitCode !== 0) {
      // 사용자 테스트 코드의 문제가 아니다. failed 로 접으면 안 된다.
      return done("error", null, `설치 실패 (exit ${install.exitCode})`);
    }

    const test = await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", req.commands.test],
      cwd: repoDir,
      timeoutMs,
    });
    logs.push(await section(req.commands.test, test));

    return done(test.exitCode === 0 ? "passed" : "failed", test.exitCode);
  } catch (err) {
    // 샌드박스 생성 실패, 클론 실패, 타임아웃, 쿼터 초과가 전부 여기로 온다.
    // 어느 쪽이든 사용자가 손댈 수 있는 게 아니라 error 다.
    return done("error", null, err instanceof Error ? err.message : String(err));
  } finally {
    // 타임아웃까지 기다리면 그만큼 요금이 붙는다. 끝났으면 바로 내린다.
    // 여기서 실패해도 원래 결과를 덮지 않는다 — 샌드박스는 timeout 이 되면 어차피 사라진다.
    await sandbox?.stop().catch(() => {});
  }
}

/**
 * git 이 클론할 때 만드는 디렉터리 이름. URL 마지막 조각에서 .git 을 뗀 것이다.
 * 예: "https://github.com/acme/web.git" → "web"
 */
function cloneDirName(url: string) {
  const last = url.replace(/\/+$/, "").split("/").pop() ?? "";
  return last.replace(/\.git$/, "");
}

function gitSource(repo: RunRequest["repo"]) {
  const base = { type: "git" as const, url: repo.url, depth: 1, revision: repo.revision };
  if (!repo.token) return base;
  // GitHub 설치 토큰은 username 자리에 관례적으로 x-access-token 을 쓴다.
  return { ...base, username: "x-access-token", password: repo.token };
}

/**
 * 명령 하나의 로그 블록. stdout 과 stderr 를 나누지 않고 합치는 이유는
 * vitest 가 둘에 걸쳐 출력해서, 나눠 놓으면 사람이 읽을 때 순서가 어그러져서다.
 */
async function section(command: string, result: CommandFinished) {
  const output = await result.output("both").catch((err: unknown) => {
    // 명령이 유효한 Unicode 를 안 뱉으면 여기서 던진다. 결과 자체는 멀쩡하므로
    // 실행을 실패로 만들지 않고 로그만 포기한다.
    return `(로그를 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)})`;
  });
  return [`$ ${command}`, output, `(exit ${result.exitCode})`].filter(Boolean).join("\n");
}

/**
 * vitest 가 실패를 길게 뱉으면 로그가 수 MB 가 되기도 한다. 그대로 DB 에 넣으면
 * 행 하나가 비대해지고 화면도 못 버틴다. 뒤쪽(실패 요약)이 중요하므로 앞을 자른다.
 */
function joinLogs(parts: string[]) {
  const joined = parts.join("\n\n");
  if (joined.length <= MAX_LOG_CHARS) return joined;
  return `… (앞부분 ${joined.length - MAX_LOG_CHARS}자 잘림)\n` + joined.slice(-MAX_LOG_CHARS);
}
