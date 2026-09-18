"use client";

import { useEffect, useRef, useState } from "react";
import { saveRecommendChat } from "../../actions";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";

// 후속 메시지 스레드 — 목업 응답. 사용자가 보내면 잠깐 뒤 정해진 응답을 붙인다.
// 진짜 AI 연결이 붙으면 이 목업 응답을 스트리밍 응답으로 교체한다.
//
// 대화는 DB(TestChatThread)에 영구 저장한다. 초기 메시지는 서버(page.tsx)가 읽어 넘겨주고,
// 여기선 바뀔 때마다 saveRecommendChat 으로 통째 덮어 저장한다 — 새로고침·재접속·다른 기기에서도
// 같은 세션을 열면 대화가 그대로 이어진다.
const MOCK_REPLY =
  "Applied your request. I added tests for that case and updated the diff on the right. Let me know if there are more scenarios to verify.";

export function FollowUp({
  projectRef,
  sessionId,
  initialMessages,
}: {
  projectRef: string;
  sessionId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, setPending] = useState(false);
  // 서버가 준 초기값을 그대로 다시 저장하지 않으려고, 첫 렌더의 저장은 건너뛴다.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    void saveRecommendChat(
      projectRef,
      sessionId,
      messages.map(({ id, role, text }) => ({ id, role, text }))
    );
  }, [projectRef, sessionId, messages]);

  const send = (text: string) => {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
    setPending(true);
    // 목업 지연 응답 — 진짜 생성처럼 보이게 살짝 텀을 둔다.
    setTimeout(() => {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: MOCK_REPLY }]);
      setPending(false);
    }, 900);
  };

  return (
    <ChatThread
      messages={messages}
      pending={pending}
      pendingLabel="Generating…"
      onSend={send}
      placeholder="Enter a follow-up request (e.g. add error cases too)"
      listClassName="min-h-0 flex-1 overflow-y-auto"
      containerClassName="flex min-h-0 flex-1 flex-col"
    />
  );
}
