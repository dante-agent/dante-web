import { after, NextResponse } from "next/server";
import { runQueuedTestRun } from "@/lib/notifications/pull-request-job";
import { verifyTestRunToken } from "@/lib/notifications/test-run-rules";

// 차례가 온 PR 작업의 샌드박스 실행을 새 함수에서 시작한다 (lib/notifications/test-run-queue.ts).
//
// 사용자도 GitHub 도 아니라 우리 서버가 자기 자신을 부르는 경로다. 쿠키가 없어서 proxy.ts 의
// 세션 갱신에서 빼 두었고, 작업 ID 와 만료를 서명한 토큰으로 "우리가 보낸 요청" 인지 확인한다.
//
// 받자마자 202 를 돌려주고 실행은 after() 로 한다. 부르는 쪽 함수가 실행이 끝날 때까지 붙잡혀 있지 않게.

/** 실행이 after() 안에서 돈다. 샌드박스 상한(10분)과 정리까지 들어가야 한다. Pro 의 최대값이다 */
export const maxDuration = 800;

export async function POST(request: Request) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  let jobId: unknown;
  try {
    ({ jobId } = (await request.json()) as { jobId?: unknown });
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  if (typeof jobId !== "string" || jobId.length === 0) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? "";
  if (!verifyTestRunToken(secret, jobId, token, new Date())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = jobId;
  after(() =>
    runQueuedTestRun(id).catch((error) => {
      console.error(`[pr-test-run] ${id} crashed`, error);
    })
  );
  return NextResponse.json({ ok: true }, { status: 202 });
}
