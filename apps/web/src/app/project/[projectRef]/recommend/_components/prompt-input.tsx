"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * 상단 프롬프트 바. 자연어로 대상을 설명하고 제출하면 곧장 새 채팅 세션(/recommend/new)으로
 * 이동한다 — 다이얼로그로 확인받지 않는다. 프롬프트가 사용자 메시지로, AI 의 추천 사유와
 * 생성 확인은 그 화면의 채팅 메시지로 이어진다(chat-session.tsx).
 */
export function PromptInput({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [navigating, startNavigate] = useTransition();
  const trimmed = value.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || navigating) return;
    startNavigate(() => {
      router.push(`/project/${projectRef}/recommend/new?prompt=${encodeURIComponent(trimmed)}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border-border flex items-center gap-3 rounded-xl border p-2 pl-4"
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
  );
}
