"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { TerminalBody, useLiveRun, type RunView } from "@/components/run-terminal";
import type { TestRunView } from "@/lib/projects/run-version";
import { cn } from "@/lib/utils";
import { regenerateFromFailure, type RegenerateResult } from "../../actions";

// 우측 코드 패널 아래의 실행 결과 영역. 폴더 보기와 같은 실시간 실행(/runs/live, NDJSON)을 쓴다 —
// 버튼을 누르면 단계(샌드박스 준비 → 설치 → 도구 → 테스트)와 러너 출력이 실시간으로 흐르고, 끝나면
// 개수 요약이 뜬다. 스트림 처리·표시(useLiveRun/TerminalBody)는 run-terminal 의 것을 그대로 쓴다.
//
// 실행이 실패하면 "Regenerate & retry" — 실패 로그로 AI 가 테스트를 고쳐 새 버전을 만들고 그 세션으로
// 이동해 자동 실행한다(?run=1). 완전 자동 재시도는 하지 않는다 — 매번 사용자가 버튼을 누른다.
//
// 처음 열 때는 저장된 마지막 실행(initialRun)의 로그를 보여준다 — 그건 단계 정보가 없는 blob 이라
// 단순 로그로 찍고, 새로 실행을 돌리면 그때부터 단계별 뷰(TerminalBody)로 바뀐다.

type Display = TestRunView["status"] | "idle" | "running";

const REGEN_ERROR: Record<Extract<RegenerateResult, { ok: false }>["reason"], string> = {
  budget: "You've exceeded this month's AI budget, so it can't be regenerated.",
  "not-found": "Couldn't find this session. Refresh and try again.",
  "not-failed": "There's no failed run to fix.",
  error: "Regeneration failed. Check your API key and AI settings.",
};

// vitest/jest 로그의 색상 코드(SGR)만 걷어낸다 — <pre> 는 escape 를 그대로 글자로 찍는다.
const ANSI_SGR = /\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_SGR, "");
}

/** 라이브 실행 뷰 → 헤더 상태 라벨. 실행 전이면 initialRun, 그것도 없으면 idle. */
function displayStatus(view: RunView | null, initialRun: TestRunView | null): Display {
  if (view) {
    if (view.running || !view.result) return "running";
    const { status } = view.result;
    return status === "passed" || status === "failed" ? status : "error";
  }
  return initialRun?.status ?? "idle";
}

export function TestRunPanel({
  projectRef,
  versionId,
  initialRun,
  runnerConfigured,
  autoRun,
}: {
  projectRef: string;
  versionId: string;
  initialRun: TestRunView | null;
  runnerConfigured: boolean;
  autoRun?: boolean;
}) {
  const router = useRouter();
  const { view, start } = useLiveRun(projectRef);
  const [regenerating, startRegen] = useTransition();
  const [regenError, setRegenError] = useState<string | null>(null);

  // 재생성 직후 이동(?run=1)이면 열자마자 한 번 자동 실행하고, 새로고침 때 또 돌지 않게 쿼리를 지운다.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current || !autoRun || !runnerConfigured) return;
    autoRanRef.current = true;
    start(versionId);
    window.history.replaceState(null, "", window.location.pathname);
  }, [autoRun, runnerConfigured, versionId, start]);

  const running = view?.running ?? false;
  const status = displayStatus(view, initialRun);
  const failed = !running && (status === "failed" || status === "error");
  // 한 번이라도 돈 적이 있으면(라이브 뷰 또는 저장된 실행) 버튼은 "Re-run".
  const ran = Boolean(view) || Boolean(initialRun);
  const busy = running || regenerating;
  const initialLogs = initialRun?.logs ? stripAnsi(initialRun.logs).trimEnd() : "";
  const message = regenError ?? (!view ? (initialRun?.errorMessage ?? null) : null);

  function regenerate() {
    setRegenError(null);
    startRegen(async () => {
      try {
        const result = await regenerateFromFailure(projectRef, versionId);
        if (result.ok) {
          // 고친 새 버전으로 이동하며 자동 실행을 건다.
          router.push(`/project/${projectRef}/recommend/${result.versionId}?run=1`);
          return;
        }
        setRegenError(REGEN_ERROR[result.reason]);
      } catch (error) {
        // redirect()/notFound() 같은 프레임워크 신호는 삼키지 않고 되던진다.
        unstable_rethrow(error);
        setRegenError(REGEN_ERROR.error);
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-black">
      <div className="border-border flex h-10 shrink-0 items-center gap-3 border-b px-3">
        <StatusLabel status={status} />
        {message && (
          <span className="text-destructive min-w-0 flex-1 truncate text-xs" title={message}>
            {message}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {failed && (
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              className="border-border hover:bg-muted/40 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-[#eeedf0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {regenerating ? "Regenerating" : "Regenerate & retry"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!busy && runnerConfigured) start(versionId);
            }}
            disabled={busy || !runnerConfigured}
            title={
              runnerConfigured
                ? undefined
                : "The test runner is not configured in this environment."
            }
            className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : ran ? (
              <RotateCcw className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {running ? "Running" : ran ? "Re-run" : "Run tests"}
          </button>
        </div>
      </div>

      {view ? (
        <TerminalBody view={view} />
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed text-[#eeedf0]">
          {initialLogs ? (
            initialLogs
          ) : (
            <span className="text-[#8a8790]">
              {runnerConfigured
                ? "Run the tests to see live install and test logs here."
                : "The test runner is not configured in this environment."}
            </span>
          )}
        </pre>
      )}
    </div>
  );
}

function StatusLabel({ status }: { status: Display }) {
  const labels: Record<Display, string> = {
    idle: "Not run",
    running: "Running",
    passed: "Passed",
    failed: "Failed",
    error: "Run error",
  };
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium",
        status === "passed" && "text-brand-mint",
        status === "failed" && "text-brand-orange",
        status === "error" && "text-destructive",
        (status === "idle" || status === "running") && "text-[#8a8790]"
      )}
    >
      {labels[status]}
    </span>
  );
}
