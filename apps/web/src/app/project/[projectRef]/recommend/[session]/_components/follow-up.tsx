"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { regenerateFromInstruction, saveRecommendChat } from "../../actions";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";

// 세션 상세 좌측 채팅. 후속 요청을 보내면 그 요청대로 테스트를 고친 새 버전을 만들고,
// 대화를 이어받은 그 세션으로 이동해 자동 실행한다(?run=1). 실패 시 오류를 채팅에 남긴다.
//
// 대화는 DB(TestChatThread)에 영구 저장한다. 초기 메시지는 서버(page.tsx)가 읽어 넘겨주고,
// 바뀔 때마다 저장해 새로고침·재접속·다른 기기에서도 이어진다.
const REGEN_ERROR: Record<string, string> = {
  budget: "You've exceeded this month's AI budget, so it can't be updated.",
  "not-found": "Couldn't find this session. Refresh and try again.",
  "not-failed": "There's nothing to update.",
  error: "Update failed. Check your API key and AI settings.",
  failed: "Couldn't update the test. Please try again in a moment.",
};

const strip = ({ id, role, text }: ChatMessage) => ({ id, role, text });

export function FollowUp({
  projectRef,
  sessionId,
  initialMessages,
}: {
  projectRef: string;
  sessionId: string;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, startTransition] = useTransition();
  // 서버가 준 초기값을 그대로 다시 저장하지 않으려고, 첫 렌더의 저장은 건너뛴다.
  const hydrated = useRef(false);

  // 대화가 바뀔 때마다 같은 세션에 저장한다(새로고침에도 남게).
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    void saveRecommendChat(projectRef, sessionId, messages.map(strip));
  }, [projectRef, sessionId, messages]);

  const send = (text: string) => {
    const next: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text }];
    setMessages(next);
    startTransition(async () => {
      try {
        const result = await regenerateFromInstruction(
          projectRef,
          sessionId,
          text,
          next.map(strip)
        );
        if (result.ok) {
          // 고친 새 버전(대화 이어받음)으로 이동해 자동 실행한다.
          router.push(`/project/${projectRef}/recommend/${result.versionId}?run=1`);
          return;
        }
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: REGEN_ERROR[result.reason] },
        ]);
      } catch (error) {
        unstable_rethrow(error);
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", text: REGEN_ERROR.failed },
        ]);
      }
    });
  };

  return (
    <ChatThread
      messages={messages}
      pending={pending}
      pendingLabel="Updating the test…"
      onSend={send}
      disabled={pending}
      placeholder="Ask for a change (e.g. add error cases too)"
      listClassName="min-h-0 flex-1 overflow-y-auto"
      containerClassName="flex min-h-0 flex-1 flex-col"
    />
  );
}
