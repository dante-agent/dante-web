"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// 채팅 형식 UI(메시지 목록 + 입력창)의 공용 뼈대. 세션 상세의 후속 대화(FollowUp)와
// 추천 입력→생성 확인 대화(new/_components/chat-session)가 함께 쓴다.
// 렌더링만 맡고, 무엇을 보내고 어떻게 응답할지는 부모가 onSend/onAction 으로 준다.

export interface ChatAction {
  key: string;
  label: string;
  variant?: "default" | "outline" | "ghost";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** 어시스턴트 메시지에 붙는 인라인 버튼 — "생성할까요?" 확인을 채팅 안에서 받기 위해. */
  actions?: ChatAction[];
}

export function ChatThread({
  messages,
  pending,
  pendingLabel = "Thinking…",
  pendingContent,
  onSend,
  onAction,
  disabled,
  placeholder = "Enter a follow-up request",
  listClassName = "max-h-56 overflow-y-auto",
  containerClassName = "border-border shrink-0 border-t",
}: {
  messages: ChatMessage[];
  pending?: boolean;
  pendingLabel?: string;
  /** 기다리는 동안 라벨 대신 보여줄 내용(생성 연출 등). */
  pendingContent?: ReactNode;
  onSend: (text: string) => void;
  onAction?: (messageId: string, actionKey: string) => void;
  disabled?: boolean;
  placeholder?: string;
  listClassName?: string;
  containerClassName?: string;
}) {
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text || pending || disabled) return;
    setDraft("");
    onSend(text);
  };

  return (
    <div className={containerClassName}>
      <div className={`space-y-3 p-3 ${listClassName}`}>
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <Sparkles className="text-brand-cobalt mt-0.5 size-4 shrink-0" />
              <div className="flex max-w-[85%] flex-col gap-2">
                <p className="text-foreground/90 text-sm whitespace-pre-line">{m.text}</p>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map((action) => (
                      <Button
                        key={action.key}
                        type="button"
                        size="sm"
                        variant={action.variant ?? "default"}
                        disabled={disabled}
                        onClick={() => onAction?.(m.id, action.key)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {pending && pendingContent ? (
          <div className="flex gap-2">
            <Sparkles className="text-brand-cobalt mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{pendingContent}</div>
          </div>
        ) : (
          pending && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Sparkles className="text-brand-cobalt size-4 shrink-0 animate-pulse" />
              {pendingLabel}
            </div>
          )
        )}
      </div>

      <div className="p-3">
        <div className="border-border bg-muted/40 focus-within:border-brand-orange/60 flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || pending || disabled}
            className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground grid size-7 place-items-center rounded-md transition-colors"
            aria-label="Send"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground/70 mt-2 text-center text-[11px]">
          AI can make mistakes, so be sure to review the generated code.
        </p>
      </div>
    </div>
  );
}
