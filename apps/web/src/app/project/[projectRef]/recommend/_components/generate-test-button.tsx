"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, LoaderCircle, Sparkles } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { generateTest, saveRecommendChat } from "../actions";

// 추천 카드의 "Generate tests" 버튼. 프롬프트 경로와 같은 도착지로 통일한다 — 모달로 코드를
// 보여주는 대신, 만든 뒤 세션 상세(채팅 + Monaco + 실행)로 바로 이동한다. 세션엔 무엇을
// 만들었는지 짧은 대화를 심어 프롬프트로 만든 세션과 같은 모양이 되게 한다.
const ERROR_MESSAGE: Record<"budget" | "not-found" | "error" | "failed" | "preview", string> = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  "not-found": "Couldn't find the recommended file. Refresh the list and try again.",
  error: "Test generation failed. Check your API key and AI settings.",
  failed: "Couldn't run test generation. Please try again in a moment.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
};

export function GenerateTestButton({
  projectRef,
  filePath,
  componentName,
}: {
  projectRef: string;
  filePath: string;
  componentName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createTest() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateTest(projectRef, filePath);
        if (!result.ok) {
          setError(ERROR_MESSAGE[result.reason]);
          return;
        }
        if (!result.versionId) {
          setError(ERROR_MESSAGE.preview);
          return;
        }
        // 세션에 초기 대화를 심어 프롬프트 경로와 같은 모양으로 만든다.
        await saveRecommendChat(projectRef, result.versionId, [
          { id: crypto.randomUUID(), role: "user", text: `Generate tests for ${componentName}` },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `Generated \`${result.testPath}\`. Review it on the right and run it when you're ready.`,
          },
        ]);
        // run=1 로 열자마자 실행해 통과 여부를 바로 보여준다.
        router.push(`/project/${projectRef}/recommend/${result.versionId}?run=1`);
      } catch (err) {
        // redirect()/notFound() 같은 프레임워크 신호는 삼키지 않고 되던진다.
        unstable_rethrow(err);
        setError(ERROR_MESSAGE.failed);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={createTest}
        disabled={pending}
        className="border-border hover:bg-muted flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {pending ? "Generating..." : "Generate tests"}
      </button>
      {error && (
        <span className="text-destructive flex max-w-48 items-center gap-1 text-right text-[11px]">
          <AlertTriangle className="size-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
