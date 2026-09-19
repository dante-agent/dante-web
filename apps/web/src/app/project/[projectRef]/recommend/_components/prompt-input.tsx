"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * 상단 프롬프트 바. 자연어로 대상을 설명하고 제출하면 곧장 새 채팅 세션(/recommend/new)으로
 * 이동한다 — 다이얼로그로 확인받지 않는다. 프롬프트가 사용자 메시지로, AI 의 추천 사유와
 * 생성 확인은 그 화면의 채팅 메시지로 이어진다(chat-session.tsx).
 */
// 처음 쓰는 사람이 뭘 적어야 할지 막막하지 않게, 입력창 안에 눌러서 바로 보내는 예시를 둔다.
// 채팅(components/ai-chat.tsx)의 빈 대화 추천 질문과 같은 캡슐·같은 등장 방식.
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
    <form
      onSubmit={handleSubmit}
      className="bg-background/60 border-border flex flex-col gap-2 rounded-xl border p-3"
    >
      <div className="flex min-h-10 items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={navigating}
          placeholder="Describe which component you need tests for..."
          aria-label="Describe which component you need tests for"
          className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent pl-1 text-sm outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={navigating || !trimmed}
          title="Send"
          aria-label="Send"
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50"
        >
          {navigating ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>

      {/* 뭔가 적기 시작하면 사라진다 — 예시는 첫 화면에서만 필요하다. */}
      {!trimmed && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="sm"
              disabled={navigating}
              onClick={() => go(example)}
              className="animate-in fade-in slide-in-from-bottom-1 rounded-full duration-200"
            >
              {example}
            </Button>
          ))}
        </div>
      )}
    </form>
  );
}
