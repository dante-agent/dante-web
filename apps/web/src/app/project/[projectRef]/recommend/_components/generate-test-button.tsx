"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, Check, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenerateTestResult } from "@/lib/projects/test-generation";
import { generateTest } from "../actions";

const ERROR_MESSAGE: Record<"budget" | "not-found" | "error" | "failed", string> = {
  budget: "이번 달 AI 예산을 초과해 테스트를 생성할 수 없습니다.",
  "not-found": "추천 파일을 찾지 못했습니다. 목록을 새로고침한 뒤 다시 시도해주세요.",
  error: "테스트 생성에 실패했습니다. API 키와 AI 설정을 확인해주세요.",
  failed: "테스트 생성을 실행하지 못했습니다. 잠시 후 다시 시도해주세요.",
};

type State = GenerateTestResult | { ok: false; reason: "failed" } | null;

export function GenerateTestButton({
  projectRef,
  filePath,
  componentName,
}: {
  projectRef: string;
  filePath: string;
  componentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<State>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(copyTimer.current ?? undefined), []);

  function createTest() {
    setResult(null);
    setCopied(false);
    setOpen(true);
    startTransition(async () => {
      try {
        setResult(await generateTest(projectRef, filePath));
      } catch {
        setResult({ ok: false, reason: "failed" });
      }
    });
  }

  async function copy() {
    if (!result?.ok || !navigator.clipboard) return;
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
    clearTimeout(copyTimer.current ?? undefined);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={createTest}
        disabled={pending}
        className="border-border hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {pending ? "생성 중..." : "테스트 생성"}
      </button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-border bg-popover fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[52rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex min-w-0 flex-col gap-1">
            <Dialog.Title className="text-base font-medium">{componentName} 테스트</Dialog.Title>
            <Dialog.Description className="text-muted-foreground truncate font-mono text-xs">
              {result?.ok ? result.testPath : filePath}
            </Dialog.Description>
          </div>

          {pending && (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              테스트 코드를 생성하고 있습니다.
            </div>
          )}

          {!pending && result?.ok && (
            <pre className="border-border bg-muted min-h-48 overflow-auto rounded-lg border p-4 font-mono text-xs leading-relaxed">
              <code>{result.code}</code>
            </pre>
          )}

          {!pending && result && !result.ok && (
            <div
              role="alert"
              className="text-destructive flex min-h-48 items-center justify-center gap-2 text-sm"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {ERROR_MESSAGE[result.reason]}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button type="button" variant="ghost" size="sm" />}>
              닫기
            </Dialog.Close>
            {result?.ok && (
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "복사됨" : "코드 복사"}
              </Button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
