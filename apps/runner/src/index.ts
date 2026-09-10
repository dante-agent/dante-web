import Fastify from "fastify";
import { runTest, type RunRequest } from "./run.js";

// 테스트 실행 서버. 실행 환경은 Vercel Sandbox (docs/adr/0001-test-runtime.md).
//
// DB 는 건드리지 않는다. 무엇을 돌릴지는 web 이 읽어서 요청에 담아 보내고,
// TestRun 행을 쓰는 것도 web 이다. 이유는 run.ts 위쪽 주석에.

const PORT = Number(process.env.PORT ?? 4000);
const RUNNER_SECRET = process.env.RUNNER_SECRET ?? "";

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

// 웹(BFF)만 이 서버를 호출한다. 공유 시크릿으로 게이트.
app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health") return;
  if (!RUNNER_SECRET || req.headers.authorization !== `Bearer ${RUNNER_SECRET}`) {
    return reply.code(401).send({ error: "unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true }));

app.post("/runs", async (req, reply) => {
  const parsed = parseRunRequest(req.body);
  if ("error" in parsed) {
    return reply.code(400).send({ error: "invalid_request", detail: parsed.error });
  }

  // 동기로 돌린다. 테스트가 몇 분 걸리면 이 요청도 그만큼 열려 있다.
  //
  // 큐를 두지 않은 이유: 지금은 호출자가 web 하나뿐이고, 결과를 TestRun 에 쓰는
  // 것도 web 이다. 여기서 비동기로 만들면 "누가 결과를 받아 적는가" 를 runner 가
  // 떠안게 되고, 그러려면 DB 를 알아야 한다. 동시 실행이 문제가 될 때 큐를 붙인다.
  const result = await runTest(parsed.value);
  return reply.code(200).send(result);
});

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

/**
 * 요청 본문 검증. zod 를 쓰지 않은 이유는 필드가 몇 개 안 되고, runner 에
 * 의존성을 하나 더 얹을 만한 일이 아니어서다 (AGENTS.md).
 */
function parseRunRequest(body: unknown): { value: RunRequest } | { error: string } {
  if (!isRecord(body)) return { error: "body 가 객체가 아닙니다" };

  const repo = body.repo;
  if (!isRecord(repo)) return { error: "repo 가 없습니다" };
  if (!isNonEmptyString(repo.url)) return { error: "repo.url 이 없습니다" };
  if (repo.revision !== undefined && !isNonEmptyString(repo.revision)) {
    return { error: "repo.revision 이 문자열이 아닙니다" };
  }
  if (repo.token !== undefined && !isNonEmptyString(repo.token)) {
    return { error: "repo.token 이 문자열이 아닙니다" };
  }

  const testFile = body.testFile;
  if (!isRecord(testFile)) return { error: "testFile 이 없습니다" };
  if (!isNonEmptyString(testFile.path)) return { error: "testFile.path 가 없습니다" };
  if (typeof testFile.content !== "string") return { error: "testFile.content 가 없습니다" };
  // 클론한 레포 밖으로 쓰지 못하게 막는다. 절대경로와 상위 참조 둘 다.
  if (testFile.path.startsWith("/") || testFile.path.split("/").includes("..")) {
    return { error: "testFile.path 는 레포 안의 상대경로여야 합니다" };
  }

  const commands = body.commands;
  if (!isRecord(commands)) return { error: "commands 가 없습니다" };
  if (!isNonEmptyString(commands.install)) return { error: "commands.install 이 없습니다" };
  if (!isNonEmptyString(commands.test)) return { error: "commands.test 가 없습니다" };

  if (body.timeoutMs !== undefined && !(typeof body.timeoutMs === "number" && body.timeoutMs > 0)) {
    return { error: "timeoutMs 가 양수가 아닙니다" };
  }

  return {
    value: {
      repo: { url: repo.url, revision: repo.revision, token: repo.token },
      testFile: { path: testFile.path, content: testFile.content },
      commands: { install: commands.install, test: commands.test },
      timeoutMs: body.timeoutMs,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
