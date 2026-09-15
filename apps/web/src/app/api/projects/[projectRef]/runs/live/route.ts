import { NextResponse } from "next/server";
import { runTestLive, type LiveEvent, type LiveResult } from "@dante/sandbox";
import { getAuthUser } from "@/lib/auth/user";
import { buildRunRequest, loadRunTarget, saveTestRun } from "@/lib/projects/run-version";

// 저장된 테스트 버전을 돌리며 진행을 실시간으로 흘려보낸다. 폴더 보기 터미널이 부른다.
//
// 응답은 NDJSON — 한 줄에 이벤트 하나. 단계 시작·끝(step), 러너 출력 조각(log), 마지막에 결과(result).
// 세션 상세의 실행(../route.ts)은 끝난 뒤 한 번에 받는 방식 그대로 둔다.
//
// 브라우저가 연결을 끊으면(탭 닫기·새로고침·이동) 샌드박스를 멈추고 결과를 남기지 않는다.

// 테스트 상한(Runtime 설정, 최대 10분)보다 길어야 "시간 초과"를 화면에 보낼 수 있다.
// 함수가 먼저 죽으면 샌드박스 정리도 결과 전송도 못 한다. PR 실행 라우트와 같은 값.
export const maxDuration = 800;

export type LiveRunMessage =
  | LiveEvent
  | {
      type: "result";
      status: LiveResult["status"];
      errorMessage: string | null;
      timedOut: boolean;
      /** 러너 리포트가 있을 때만. 없으면 개수를 모른다(0 으로 적지 않는다). */
      totals: { total: number; passed: number; failed: number } | null;
      failures: { file: string; name: string; message: string | null }[];
      durationMs: number;
    };

const HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "private, no-store",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectRef: string }> }
) {
  const { projectRef } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const versionId =
    body && typeof body === "object" && "versionId" in body && typeof body.versionId === "string"
      ? body.versionId
      : null;
  if (!versionId) return NextResponse.json({ error: "versionId is required" }, { status: 400 });

  const target = await loadRunTarget(projectRef, user.id, versionId);

  // 요청이 끊기거나(request.signal) 응답 스트림이 취소되면(cancel) 러너를 멈춘다.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (message: LiveRunMessage) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(message) + "\n"));
        } catch {
          // 이미 닫힌 스트림. 브라우저가 떠난 것이라 보낼 곳이 없다.
        }
      };

      if (!target.ok) {
        send({
          type: "result",
          status: "error",
          errorMessage: target.view.errorMessage,
          timedOut: false,
          totals: null,
          failures: [],
          durationMs: 0,
        });
        controller.close();
        return;
      }

      const startedAt = Date.now();
      let result: LiveResult;
      try {
        result = await runTestLive(await buildRunRequest(target), {
          signal: abort.signal,
          onEvent: send,
        });
      } catch (error) {
        // 러너에 닿기 전(설치 토큰 발급 등)에 실패. 세션 상세 실행과 같이 error 로 접는다.
        const now = new Date().toISOString();
        result = {
          status: "error",
          exitCode: null,
          logs: "",
          errorMessage: error instanceof Error ? error.message : String(error),
          report: null,
          startedAt: now,
          finishedAt: now,
          timedOut: false,
        };
      }

      // 중단한 실행은 결과가 아니다 — 기록하지 않는다.
      if (abort.signal.aborted) return;

      try {
        await saveTestRun(target.versionId, result);
      } catch (error) {
        // 결과는 이미 나왔다. 저장 실패로 화면의 결과를 가리지 않고 로그만 남긴다.
        console.error("[runs/live] 실행 결과 저장 실패", error);
      }

      send({
        type: "result",
        status: result.status,
        errorMessage: result.errorMessage ?? null,
        timedOut: result.timedOut,
        totals: result.report?.totals ?? null,
        failures: result.report?.failures ?? [],
        durationMs: Date.now() - startedAt,
      });
      try {
        controller.close();
      } catch {
        // 이미 닫힘
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers: HEADERS });
}
