"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import type { Terminal } from "@xterm/xterm";
import { cn } from "@/lib/utils";

export type TestRunView = {
  status: "queued" | "running" | "passed" | "failed" | "error";
  logs: string | null;
  errorMessage: string | null;
};

type StreamEvent =
  | { type: "run"; runId: string }
  | { type: "log"; stream: "stdout" | "stderr"; data: string }
  | { type: "result"; result: TestRunView };

export function TestTerminal({
  projectRef,
  versionId,
  initialRun,
}: {
  projectRef: string;
  versionId: string;
  initialRun: TestRunView | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<TestRunView["status"] | "idle">(
    initialRun?.status ?? "idle"
  );
  const [error, setError] = useState(initialRun?.errorMessage ?? null);
  const running = status === "queued" || status === "running";

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let terminal: Terminal | undefined;

    void Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
      ([{ Terminal }, { FitAddon }]) => {
        if (disposed || !hostRef.current) return;
        terminal = new Terminal({
          convertEol: true,
          cursorBlink: false,
          disableStdin: true,
          fontFamily: 'var(--font-mono), "SFMono-Regular", Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.35,
          scrollback: 5_000,
          theme: { background: "#121014", foreground: "#eeedf0", cursor: "#ff570a" },
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(hostRef.current);
        terminalRef.current = terminal;
        if (initialRun?.logs) terminal.write(initialRun.logs);
        else
          terminal.writeln(
            "\x1b[90m테스트를 실행하면 설치 및 테스트 로그가 여기에 표시됩니다.\x1b[0m"
          );
        fitAddon.fit();
        observer = new ResizeObserver(() => fitAddon.fit());
        observer.observe(hostRef.current);
        setReady(true);
      }
    );

    return () => {
      disposed = true;
      observer?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
    };
  }, [initialRun?.logs]);

  async function runTest() {
    const terminal = terminalRef.current;
    if (!terminal || running) return;

    terminal.reset();
    terminal.writeln("\x1b[90m격리된 테스트 환경을 준비하고 있습니다...\x1b[0m");
    setStatus("queued");
    setError(null);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectRef)}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `실행 요청에 실패했습니다. (${response.status})`);
      }

      setStatus("running");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) consumeEvent(line, terminal, setStatus, setError);
      }
      if (pending) consumeEvent(pending, terminal, setStatus, setError);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "테스트 실행에 실패했습니다.";
      terminal.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      setStatus("error");
      setError(message);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#121014]">
      <div className="border-border flex h-10 shrink-0 items-center gap-3 border-b px-3">
        <Status status={status} />
        {error && <span className="text-destructive min-w-0 flex-1 truncate text-xs">{error}</span>}
        <button
          type="button"
          onClick={runTest}
          disabled={!ready || running}
          className="bg-primary text-primary-foreground ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : initialRun ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {running ? "실행 중" : initialRun ? "다시 실행" : "테스트 실행"}
        </button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 p-3" aria-label="테스트 실행 터미널" />
    </div>
  );
}

function consumeEvent(
  line: string,
  terminal: Terminal,
  setStatus: (status: TestRunView["status"]) => void,
  setError: (error: string | null) => void
) {
  let event: StreamEvent;
  try {
    event = JSON.parse(line) as StreamEvent;
  } catch {
    return;
  }

  if (event.type === "log") {
    terminal.write(event.stream === "stderr" ? `\x1b[31m${event.data}\x1b[0m` : event.data);
  } else if (event.type === "result") {
    setStatus(event.result.status);
    setError(event.result.errorMessage ?? null);
  }
}

function Status({ status }: { status: TestRunView["status"] | "idle" }) {
  const labels = {
    idle: "실행 전",
    queued: "대기 중",
    running: "실행 중",
    passed: "통과",
    failed: "실패",
    error: "실행 오류",
  } as const;
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium",
        status === "passed" && "text-brand-mint",
        status === "failed" && "text-brand-orange",
        status === "error" && "text-destructive",
        (status === "idle" || status === "queued" || status === "running") &&
          "text-muted-foreground"
      )}
    >
      {labels[status]}
    </span>
  );
}
