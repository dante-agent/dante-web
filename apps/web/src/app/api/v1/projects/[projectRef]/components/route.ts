import { prisma } from "@dante/db";
import { authenticateExtension, unauthorized } from "@/lib/extension/auth";

// 익스텐션 사이드바의 컴포넌트 트리 (dante-extension 기능 4).
// 응답 모양은 dante-extension 의 src/api/types.ts `Component` 와 맞춘다.
//
// 경로의 식별자는 UUID(PK) 가 아니라 프로젝트의 ref 다. /api/v1/projects 가
// `id` 자리에 ref 를 내려보내고 익스텐션은 그 값을 그대로 되돌려 보낸다.
export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/projects/[projectRef]/components">
) {
  const token = await authenticateExtension(request);
  if (!token) return unauthorized();

  const { projectRef } = await context.params;

  // 프로젝트와 컴포넌트를 한 번에 읽는다. 컴포넌트를 따로 조회하면 컴포넌트가
  // 0개인 프로젝트와 남의 프로젝트를 구분하지 못한다.
  //
  // 중첩 select 의 take 는 관계 깊이만큼의 질의로 끝난다 — 컴포넌트 수만큼
  // 질의가 늘어나지 않는다(N+1 금지).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: token.userId },
    select: {
      components: {
        // 트리 순서가 새로고침마다 흔들리지 않게 완전히 결정적으로 정렬한다.
        orderBy: [{ filePath: "asc" }, { exportName: "asc" }],
        select: {
          id: true,
          filePath: true,
          exportName: true,
          // 컴포넌트당 테스트 파일은 하나다 (schema.prisma @@unique([componentId])).
          testFiles: {
            take: 1,
            select: {
              versions: {
                orderBy: { version: "desc" },
                take: 1,
                select: {
                  runs: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { status: true, finishedAt: true, createdAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // 남의 프로젝트도 404 로 가린다. 403 으로 나누면 ref 만 바꿔가며 "이 프로젝트가
  // 존재하는가"를 알아낼 수 있다.
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json(
    project.components.map((component) => {
      const run = component.testFiles[0]?.versions[0]?.runs[0] ?? null;

      return {
        id: component.id,
        filePath: component.filePath,
        exportName: component.exportName,
        // 항상 null. 웹 스키마에 컴포넌트 소스의 해시를 담는 열이 없고, 산출
        // 규칙도 아직 정해지지 않았다 (dante-extension docs/기획.md §7, D-8 제안 중).
        // 열이 생기기 전에 아무 값이나 채우면 익스텐션이 웹과 다른 해시를 비교하게 되어
        // 모든 컴포넌트가 영원히 스테일로 보인다.
        sourceSha: null,
        testStatus: toTestStatus(run?.status),
        lastRunAt: run ? (run.finishedAt ?? run.createdAt).toISOString() : null,
      };
    })
  );
}

/**
 * TestRun.status → 익스텐션의 TestStatus.
 *
 * `stale`("테스트는 통과했지만 그 뒤로 소스가 바뀌었다")은 여기서 절대 내려보내지
 * 않는다. 판정하려면 실행 당시의 sourceSha 와 지금 소스의 sourceSha 를 비교해야
 * 하는데 위에서 적었듯 서버에 그 값이 없다. 모르는 것을 stale 로 단정하면
 * 사용자는 멀쩡한 테스트를 계속 다시 돌린다.
 *
 * queued·running·error 는 `unknown` 으로 접는다 — "아직 결과가 아님"과
 * "실행 자체가 실패함"은 둘 다 통과·실패로 말할 수 없는 상태다.
 */
function toTestStatus(status: string | undefined) {
  if (status === undefined) return "none"; // 테스트 파일이 없거나 한 번도 돌리지 않았다
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  return "unknown";
}
