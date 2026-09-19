"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAnnounce } from "@/components/live-announcer";
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

  // 새 AI 메시지(오류 포함)와 기다리는 문구를 스크린리더에 알린다. 서버가 준 지난 대화는
  // 처음 그릴 때 이미 있던 것이라 읽지 않는다. 생성 연출(pendingContent)은 자기 단계를 알린다.
  const last = messages.at(-1);
  const [initialLastId] = useState(last?.id);
  useAnnounce(
    last && last.role === "assistant" && last.id !== initialLastId ? `AI: ${last.text}` : null,
    last?.id
  );
  useAnnounce(pending && !pendingContent ? pendingLabel : null);

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
              {/* 누가 한 말인지는 좌우 위치로만 보여서 스크린리더용 이름을 붙인다. */}
              <p className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm">
                <span className="sr-only">You: </span>
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <Sparkles className="text-brand-cobalt mt-0.5 size-4 shrink-0" />
              <div className="flex max-w-[85%] flex-col gap-2">
                <p className="text-foreground/90 text-sm whitespace-pre-line">
                  <span className="sr-only">AI: </span>
                  {m.text}
                </p>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map((action) => (
                      <Button
                        key={action.key}
                        type="button"
                        size="sm"
                        variant={action.variant ?? "default"}
                        disabled={disabled}
                        focusableWhenDisabled
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
        <div className="border-border bg-muted/40 focus-within:border-ring flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
            }}
            // 보낸 직후 막혀도 포커스가 입력창에 남도록 disabled 대신 readOnly·aria-disabled.
            readOnly={disabled}
            aria-disabled={disabled}
            placeholder={placeholder}
            aria-label="Follow-up request"
            className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none aria-disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            // 누르면 입력이 비워져 바로 막힌다. disabled 면 누른 버튼이 포커스를 잃으므로
            // aria-disabled 로 표시만 하고, 막는 건 send() 가 한다.
            aria-disabled={!draft.trim() || pending || disabled}
            className="bg-primary text-primary-foreground aria-disabled:bg-muted aria-disabled:text-muted-foreground grid size-7 place-items-center rounded-md transition-colors"
            aria-label="Send"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          AI can make mistakes, so be sure to review the generated code.
        </p>
      </div>
    </div>
  );
}
