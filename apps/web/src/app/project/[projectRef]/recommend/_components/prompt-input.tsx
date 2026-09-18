"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * 상단 프롬프트 바. 자연어로 대상을 설명하고 제출하면 곧장 새 채팅 세션(/recommend/new)으로
 * 이동한다 — 다이얼로그로 확인받지 않는다. 프롬프트가 사용자 메시지로, AI 의 추천 사유와
 * 생성 확인은 그 화면의 채팅 메시지로 이어진다(chat-session.tsx).
 */
// 처음 쓰는 사람이 뭘 적어야 할지 막막하지 않게, 눌러서 바로 보내는 예시.
const EXAMPLES = [
  "the top files without tests",
  "the main page component",
  "the form validation logic",
];

export function PromptInput({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [navigating, startNavigate] = useTransition();
  const trimmed = value.trim();

  function go(prompt: string) {
    if (!prompt || navigating) return;
    startNavigate(() => {
      router.push(`/project/${projectRef}/recommend/new?prompt=${encodeURIComponent(prompt)}`);
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    go(trimmed);
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={handleSubmit}
        className="bg-background/60 border-border flex min-h-16 items-center gap-3 rounded-xl border p-2 pl-4"
      >
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={navigating}
          placeholder="Describe which component you need tests for..."
          className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={navigating || !trimmed}
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50"
        >
          {navigating ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 pl-1">
        <span className="text-muted-foreground text-xs">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => go(example)}
            disabled={navigating}
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
