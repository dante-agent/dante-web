"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { generateTest, saveRecommendChat } from "../actions";

// 추천 카드의 클릭 영역. 프롬프트 경로와 같은 도착지로 통일한다 — 모달로 코드를
// 보여주는 대신, 만든 뒤 세션 상세(채팅 + Monaco + 실행)로 바로 이동한다. 세션엔 무엇을
// 만들었는지 짧은 대화를 심어 프롬프트로 만든 세션과 같은 모양이 되게 한다.
const ERROR_MESSAGE: Record<"budget" | "not-found" | "error" | "failed" | "preview", string> = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  "not-found": "Couldn't find the recommended file. Refresh the list and try again.",
  error: "Test generation failed. Check your API key and AI settings.",
  failed: "Couldn't run test generation. Please try again in a moment.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
};

/** 카드 전체가 "테스트 생성" 버튼이다. children 이 카드 본문. */
export function GenerateTestButton({
  projectRef,
  filePath,
  componentName,
  children,
}: {
  projectRef: string;
  filePath: string;
  componentName: string;
  children: React.ReactNode;
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
        // 생성 직후에는 실행하지 않는다 — 사용자가 코드를 보고 Run 을 눌러 돌린다.
        router.push(`/project/${projectRef}/recommend/${result.versionId}`);
      } catch (err) {
        // redirect()/notFound() 같은 프레임워크 신호는 삼키지 않고 되던진다.
        unstable_rethrow(err);
        setError(ERROR_MESSAGE.failed);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={createTest}
        disabled={pending}
        aria-label={`Generate tests for ${componentName}`}
        className="group hover:bg-muted/50 flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors disabled:opacity-60"
      >
        {children}
        {pending ? (
          <LoaderCircle className="text-muted-foreground size-4 shrink-0 animate-spin self-center" />
        ) : (
          <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 self-center transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        )}
      </button>
      {error && (
        <span className="text-destructive flex items-center gap-1 px-3 pb-2 text-[11px]">
          <AlertTriangle className="size-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
