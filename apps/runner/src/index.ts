import Fastify from "fastify";

// ponytail: 껍데기만. 테스트 실행/도커 오케스트레이션 로직은 ADR-0001 확정 후 채운다.

const PORT = Number(process.env.PORT ?? 4000);
const RUNNER_SECRET = process.env.RUNNER_SECRET ?? "";

const app = Fastify({ logger: true });

// 웹(BFF)만 이 서버를 호출한다. 공유 시크릿으로 게이트.
app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health") return;
  if (!RUNNER_SECRET || req.headers.authorization !== `Bearer ${RUNNER_SECRET}`) {
    return reply.code(401).send({ error: "unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true }));

app.post("/runs", async (req, reply) => {
  // TODO: { testFileVersionId } 받아서 도커 컨테이너에서 vitest/jest 실행 → 결과/로그 반환
  return reply.code(501).send({ error: "not_implemented" });
});

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
