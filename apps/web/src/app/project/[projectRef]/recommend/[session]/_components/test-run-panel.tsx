"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useAnnounce } from "@/components/live-announcer";
import { StoredRunLog, TerminalBody, useLiveRun, type RunView } from "@/components/run-terminal";
import type { TestRunView } from "@/lib/projects/run-version";
import { cn } from "@/lib/utils";
import { regenerateFromFailure, type RegenerateResult } from "../../actions";

// 우측 코드 패널 아래의 실행 결과 영역. 폴더 보기와 같은 실시간 실행(/runs/live, NDJSON)을 쓴다 —
// 버튼을 누르면 단계(샌드박스 준비 → 설치 → 도구 → 테스트)와 러너 출력이 실시간으로 흐르고, 끝나면
// 개수 요약이 뜬다. 스트림 처리·표시(useLiveRun/TerminalBody)는 run-terminal 의 것을 그대로 쓴다.
//
// 실행이 실패하면 "Regenerate & retry" — 실패 로그로 AI 가 테스트를 고쳐 새 버전을 만들고 그 세션으로
// 이동한다. 실행은 자동으로 하지 않는다 — 매번 사용자가 버튼을 누른다.
//
// 처음 열 때는 저장된 마지막 실행(initialRun)의 로그를 같은 터미널 모양(StoredRunLog)으로 보여주고,
// 새로 실행을 돌리면 그때부터 실시간 뷰(TerminalBody)로 바뀐다.

type Display = TestRunView["status"] | "idle" | "running";

const REGEN_ERROR: Record<Extract<RegenerateResult, { ok: false }>["reason"], string> = {
  budget: "You've exceeded this month's AI budget, so it can't be regenerated.",
  "not-found": "Couldn't find this session. Refresh and try again.",
  "not-failed": "There's no failed run to fix.",
  error: "Regeneration failed. Check your API key and AI settings.",
};

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
}: {
  projectRef: string;
  versionId: string;
  initialRun: TestRunView | null;
  runnerConfigured: boolean;
}) {
  const router = useRouter();
  const { view, start } = useLiveRun(projectRef);
  const [regenerating, startRegen] = useTransition();
  const [regenError, setRegenError] = useState<string | null>(null);

  const running = view?.running ?? false;
  const status = displayStatus(view, initialRun);

  // 실행이 끝나면 새로고침해 사이드바의 세션 상태 아이콘(통과/실패)을 맞춘다.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) router.refresh();
    wasRunning.current = running;
  }, [running, router]);
  const failed = !running && (status === "failed" || status === "error");
  // 한 번이라도 돈 적이 있으면(라이브 뷰 또는 저장된 실행) 버튼은 "Re-run".
  const ran = Boolean(view) || Boolean(initialRun);
  const busy = running || regenerating;
  const message = regenError ?? (!view ? (initialRun?.errorMessage ?? null) : null);

  function regenerate() {
    setRegenError(null);
    startRegen(async () => {
      try {
        const result = await regenerateFromFailure(projectRef, versionId);
        if (result.ok) {
          // 고친 새 버전으로 이동한다. 실행은 사용자가 Run 을 눌러 한다.
          router.push(`/project/${projectRef}/recommend/${result.versionId}`);
          // 좌측 사이드바는 레이아웃이라 이동만으로는 다시 그리지 않는다. 새 세션이 목록에 뜨게 새로고침한다.
          router.refresh();
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
          <span
            role="alert"
            className="text-destructive min-w-0 flex-1 truncate text-xs"
            title={message}
          >
            {message}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {failed && (
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              className="border-border hover:bg-muted/40 flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-[#eeedf0] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="bg-primary text-primary-foreground flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
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
      ) : initialRun?.logs ? (
        <StoredRunLog logs={initialRun.logs} />
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed text-[#8a8790]">
          {runnerConfigured
            ? "Run the tests to see live install and test logs here."
            : "The test runner is not configured in this environment."}
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
  // 처음 그릴 때의 상태(지난 실행 결과)는 읽지 않고, 이 화면에서 바뀐 뒤부터 알린다.
  // 끝났을 때는 터미널(TerminalBody)이 개수까지 붙여 한 번 더 알린다 — 나중 것이 이긴다.
  const [shown, setShown] = useState(status);
  const [changed, setChanged] = useState(false);
  if (status !== shown) {
    setShown(status);
    setChanged(true);
  }
  useAnnounce(changed ? `Tests: ${labels[status]}` : null);
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium",
        status === "passed" && "text-brand-mint",
        (status === "failed" || status === "error") && "text-destructive",
        status === "running" && "text-chart-amber",
        status === "idle" && "text-[#8a8790]"
      )}
    >
      {labels[status]}
    </span>
  );
}
