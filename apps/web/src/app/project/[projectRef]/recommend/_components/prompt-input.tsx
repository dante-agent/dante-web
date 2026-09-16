"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateTestsFromPrompt, type PromptGenerateResult } from "../actions";

type FailReason = Extract<PromptGenerateResult, { ok: false }>["reason"] | "failed";

const ERROR_MESSAGE: Record<FailReason, string> = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  "no-match": "Couldn't find a matching file. Try describing the component differently.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
  error: "Test generation failed. Check your API key and AI settings.",
  failed: "Couldn't run test generation. Please try again in a moment.",
};

/**
 * 상단 프롬프트 바. 자연어로 대상을 설명하면 AI 가 후보에서 관련 파일을 최대 3개 골라
 * 테스트를 생성하고, 첫 생성분의 세션 상세로 이동한다. 실패는 폼 아래에 안내한다.
 */
export function PromptInput({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trimmed = value.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateTestsFromPrompt(projectRef, trimmed);
        if (result.ok) {
          // 이동이 끝날 때까지 transition 이 pending 이라 입력창은 잠긴 채로 유지된다.
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
    <div className="flex flex-col gap-2">
      <form
        onSubmit={handleSubmit}
        className="bg-card border-border flex items-center gap-3 rounded-xl border p-2 pl-4"
      >
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          placeholder="Describe which component you need tests for..."
          className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !trimmed}
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-destructive flex items-center gap-1.5 px-1 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
