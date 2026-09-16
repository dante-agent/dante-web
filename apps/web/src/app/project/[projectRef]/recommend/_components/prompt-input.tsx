"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  generatePlannedTests,
  planTestGeneration,
  type PlanTarget,
  type PromptGenerateResult,
  type TestPlanResult,
} from "../actions";

type Plan = Extract<TestPlanResult, { ok: true }>;
type FailReason =
  | Extract<TestPlanResult, { ok: false }>["reason"]
  | Extract<PromptGenerateResult, { ok: false }>["reason"]
  | "failed";

const ERROR_MESSAGE: Record<FailReason, string> = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
  error: "Test generation failed. Check your API key and AI settings.",
  failed: "Couldn't run test generation. Please try again in a moment.",
};

/**
 * 상단 프롬프트 바. 자연어로 대상을 설명하고 제출하면 바로 만들지 않고, 먼저 AI 로 계획을 세워
 * 확인 다이얼로그를 띄운다 — "한 번에 최대 3개까지" 안내하고, 매칭된 파일을 생성하거나
 * (원하는 게 없으면) 추천 상위 3개를 생성하도록. 확인하면 생성하고 첫 세션 상세로 이동한다.
 */
export function PromptInput({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planning, startPlan] = useTransition();
  const [generating, startGen] = useTransition();
  const trimmed = value.trim();
  const busy = planning || generating;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || busy) return;
    setPlan(null);
    setError(null);
    setOpen(true);
    startPlan(async () => {
      try {
        const result = await planTestGeneration(projectRef, trimmed);
        if (result.ok) setPlan(result);
        else setError(ERROR_MESSAGE[result.reason]);
      } catch {
        setError(ERROR_MESSAGE.failed);
      }
    });
  }

  function generate(targets: PlanTarget[]) {
    setError(null);
    startGen(async () => {
      try {
        const result = await generatePlannedTests(
          projectRef,
          targets.map((t) => t.filePath)
        );
        if (result.ok) {
          // 이동이 끝날 때까지 transition 이 pending 이라 다이얼로그는 스피너로 유지된다.
          router.push(`/project/${projectRef}/recommend/${result.versionId}`);
          return;
        }
        setError(ERROR_MESSAGE[result.reason]);
      } catch {
        setError(ERROR_MESSAGE.failed);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <form
        onSubmit={handleSubmit}
        className="bg-card border-border flex items-center gap-3 rounded-xl border p-2 pl-4"
      >
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
          placeholder="Describe which component you need tests for..."
          className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !trimmed}
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50"
        >
          {planning ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </button>
      </form>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-border bg-popover fixed top-1/2 left-1/2 z-50 flex w-[32rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">Generate tests</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-xs">
              You can generate up to 3 test files at once.
            </Dialog.Description>
          </div>

          {(planning || generating) && (
            <div className="text-muted-foreground flex min-h-24 items-center justify-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              {planning ? "Finding matching files." : "Generating test code."}
            </div>
          )}

          {!busy && error && (
            <div
              role="alert"
              className="text-destructive flex min-h-24 items-center justify-center gap-2 text-sm"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {!busy && !error && plan && (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs">
                {plan.matched.length > 0
                  ? "Files matched to your description:"
                  : "Couldn't pin down a specific file. Refine your description, or generate the top recommended files."}
              </p>
              {(plan.matched.length > 0 ? plan.matched : plan.top).length > 0 && (
                <ul className="border-border bg-muted flex flex-col gap-1 rounded-lg border p-3 font-mono text-xs">
                  {(plan.matched.length > 0 ? plan.matched : plan.top).map((target) => (
                    <li key={target.filePath} className="truncate">
                      {target.filePath}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close
              render={<Button type="button" variant="ghost" size="sm" disabled={busy} />}
            >
              Cancel
            </Dialog.Close>
            {!busy && !error && plan && plan.matched.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={plan.top.length === 0}
                onClick={() => generate(plan.top)}
              >
                Generate top 3 instead
              </Button>
            )}
            {!busy && !error && plan && (
              <Button
                type="button"
                size="sm"
                disabled={(plan.matched.length > 0 ? plan.matched : plan.top).length === 0}
                onClick={() => generate(plan.matched.length > 0 ? plan.matched : plan.top)}
              >
                <Sparkles data-icon="inline-start" />
                {plan.matched.length > 0 ? "Generate these" : "Generate top 3"}
              </Button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
