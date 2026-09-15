"use client";

import { useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestRunView } from "@/lib/projects/run-version";

// 우측 코드 패널 아래의 실행 결과 영역. main 러너는 동기(비스트리밍)라 버튼을 누르면
// 완료까지 기다렸다가 최종 로그·상태를 한 번에 보여준다. xterm 없이 단순 로그 뷰다
// (라이브 스트림이 없어 터미널 에뮬레이터가 필요 없다).

type Display = TestRunView["status"] | "idle" | "running";

// vitest/jest 로그의 색상 코드(SGR)만 걷어낸다 — <pre> 는 escape 를 그대로 글자로 찍는다.
const ANSI_SGR = /\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_SGR, "");
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
  const [run, setRun] = useState<TestRunView | null>(initialRun);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectRef)}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `Run request failed (${response.status}).`);
      }
      setRun((await response.json()) as TestRunView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The run request failed.");
    } finally {
      setPending(false);
    }
  }

  const status: Display = pending ? "running" : (run?.status ?? "idle");
  const message = error ?? run?.errorMessage ?? null;
  const logs = run?.logs ? stripAnsi(run.logs).trimEnd() : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#121014]">
      <div className="border-border flex h-10 shrink-0 items-center gap-3 border-b px-3">
        <StatusLabel status={status} />
        {message && (
          <span className="text-destructive min-w-0 flex-1 truncate text-xs" title={message}>
            {message}
          </span>
        )}
        <button
          type="button"
          onClick={trigger}
          disabled={pending || !runnerConfigured}
          title={
            runnerConfigured ? undefined : "The test runner is not configured in this environment."
          }
          className="bg-primary text-primary-foreground ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : run ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {pending ? "Running" : run ? "Re-run" : "Run tests"}
        </button>
      </div>

      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed text-[#eeedf0]">
        {logs ? (
          logs
        ) : (
          <span className="text-[#8a8790]">
            {runnerConfigured
              ? "Run the tests to see install and test logs here."
              : "The test runner is not configured in this environment."}
          </span>
        )}
      </pre>
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
