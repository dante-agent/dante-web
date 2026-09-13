"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

// 후속 메시지 스레드 — 목업. 사용자가 보내면 잠깐 뒤 정해진 응답을 붙인다.
// 진짜 AI 연결이 붙으면 이 목업 응답을 스트리밍 응답으로 교체한다.
interface Message {
  role: "user" | "assistant";
  text: string;
}

const MOCK_REPLY =
  "Applied your request. I added tests for that case and updated the diff on the right. Let me know if there are more scenarios to verify.";

export function FollowUp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setDraft("");
    setPending(true);
    // 목업 지연 응답 — 진짜 생성처럼 보이게 살짝 텀을 둔다.
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: MOCK_REPLY }]);
      setPending(false);
    }, 900);
  };

  return (
    <div className="border-border shrink-0 border-t">
      {messages.length > 0 && (
        <div className="max-h-56 space-y-3 overflow-y-auto p-3">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm">{m.text}</p>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <Sparkles className="text-brand-cobalt mt-0.5 size-4 shrink-0" />
                <p className="text-foreground/90 max-w-[85%] text-sm">{m.text}</p>
              </div>
            )
          )}
          {pending && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Sparkles className="text-brand-cobalt size-4 shrink-0 animate-pulse" />
              Generating…
            </div>
          )}
        </div>
      )}

      <div className="p-3">
        <div className="border-border bg-muted/40 focus-within:border-brand-orange/60 flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
            }}
            placeholder="Enter a follow-up request (e.g. add error cases too)"
            className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || pending}
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
