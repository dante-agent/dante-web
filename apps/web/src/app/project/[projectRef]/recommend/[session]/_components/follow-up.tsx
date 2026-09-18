"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { GenerationSteps } from "@/components/generation/generation-steps";
import { SendingFiles } from "@/components/generation/sending-files";
import { regenerateFromInstruction, saveRecommendChat } from "../../actions";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";
import { isRegenerating, useRegeneration } from "./regeneration";

// 세션 상세 좌측 채팅. 후속 요청을 보내면 그 요청대로 테스트를 고친 새 버전을 만들고,
// 대화를 이어받은 그 세션으로 이동해 자동 실행한다(?run=1). 실패 시 오류를 채팅에 남긴다.
// 기다리는 동안엔 생성 화면과 같은 연출을 한다 — 여기엔 파일 전송·단계, 우측엔 코드 타이핑(regeneration.tsx).
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
  targetFile,
  initialMessages,
}: {
  projectRef: string;
  sessionId: string;
  /** 테스트 대상 소스 파일 — 전송 연출에 보여준다. */
  targetFile: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const regeneration = useRegeneration();
  const { stage, start } = regeneration;
  const pending = isRegenerating(regeneration);
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

  const fail = (text: string) => {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text }]);
    return { ok: false as const, message: text };
  };

  const send = (text: string) => {
    const next: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text }];
    setMessages(next);
    start(async () => {
      try {
        const result = await regenerateFromInstruction(
          projectRef,
          sessionId,
          text,
          next.map(strip)
        );
        if (!result.ok) return fail(REGEN_ERROR[result.reason]);
        // 받은 코드를 우측에 타이핑한 뒤, 고친 새 버전(대화 이어받음)으로 이동해 자동 실행한다.
        const { versionId, testPath, code } = result;
        return { ok: true, files: [{ versionId, testPath, code }] };
      } catch (error) {
        unstable_rethrow(error);
        return fail(REGEN_ERROR.failed);
      }
    });
  };

  return (
    <ChatThread
      messages={messages}
      pending={pending}
      pendingContent={
        stage && (
          <div className="flex flex-col gap-3">
            <SendingFiles files={[targetFile]} stage={stage} />
            <GenerationSteps stage={stage} finalLabel="Opening the new version" />
          </div>
        )
      }
      onSend={send}
      disabled={pending}
      placeholder="Ask for a change (e.g. add error cases too)"
      listClassName="min-h-0 flex-1 overflow-y-auto"
      containerClassName="flex min-h-0 flex-1 flex-col"
    />
  );
}
