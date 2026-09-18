"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import {
  generatePlannedTests,
  planTestGeneration,
  saveRecommendChat,
  type PlanTarget,
  type PromptGenerateResult,
  type TestPlanResult,
} from "../../actions";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";

type FailReason =
  | Extract<TestPlanResult, { ok: false }>["reason"]
  | Extract<PromptGenerateResult, { ok: false }>["reason"]
  | "failed";

const ERROR_MESSAGE: Record<FailReason, string> = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
  error: "Test generation failed. Check your API key and AI settings.",
  failed: "Couldn't run test generation. Please try again in a moment.",
};

const uid = () => crypto.randomUUID();

/**
 * 프롬프트→계획→추천 사유+생성 확인→생성 의 전체 흐름을 채팅 메시지로 이어 붙인다.
 * 확정되면 generatePlannedTests 로 저장하고, 방금까지의 대화를 만든 세션들(DB)에 심어
 * 실제 세션(/recommend/[session])의 FollowUp 이 이어서 보여줄 수 있게 한 뒤 그리로 이동한다.
 */
export function ChatSession({
  projectRef,
  initialPrompt,
}: {
  projectRef: string;
  initialPrompt: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, startBusy] = useTransition();
  const [pendingLabel, setPendingLabel] = useState("Finding matching files…");
  // 확인 메시지 id → 그 시점에 세운 계획(확정 시 어떤 파일을 생성할지). 액션 버튼 클릭 때 꺼내 쓴다.
  const plansRef = useRef(new Map<string, { matched: PlanTarget[]; top: PlanTarget[] }>());
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    submit(initialPrompt);
    // 프롬프트를 URL 에서 지운다 — 이 화면에서 새로고침·뒤로가기 해도 다시 생성(재과금)되지
    // 않게. prompt 가 없으면 new/page.tsx 가 목록으로 리다이렉트한다.
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushAssistant(text: string, actions?: ChatMessage["actions"]) {
    const id = uid();
    setMessages((m) => [...m, { id, role: "assistant", text, actions }]);
    return id;
  }

  function submit(prompt: string) {
    setMessages((m) => [...m, { id: uid(), role: "user", text: prompt }]);
    setPendingLabel("Finding matching files…");
    startBusy(async () => {
      try {
        const result = await planTestGeneration(projectRef, prompt);
        if (!result.ok) {
          pushAssistant(ERROR_MESSAGE[result.reason]);
          return;
        }
        const { matched, top, reasoning } = result;
        const hasMatch = matched.length > 0;
        const primary = hasMatch ? matched : top;
        if (primary.length === 0) {
          pushAssistant(reasoning || "Couldn't find any files to recommend.");
          return;
        }

        const list = primary.map((t) => `• ${t.filePath}`).join("\n");
        const question = hasMatch
          ? `Generate ${matched.length === 1 ? "a test" : `${matched.length} tests`} for the file${matched.length > 1 ? "s" : ""} above?`
          : `Couldn't pin down a specific file. Generate tests for the top ${top.length} recommended file${top.length > 1 ? "s" : ""} instead?`;
        const text = [reasoning, list, question].filter(Boolean).join("\n\n");

        const actions: NonNullable<ChatMessage["actions"]> = [
          { key: "confirm-primary", label: hasMatch ? "Generate these" : "Generate top files" },
        ];
        if (hasMatch && top.length > 0) {
          actions.push({ key: "confirm-top", label: "Generate top 3 instead", variant: "outline" });
        }
        actions.push({ key: "cancel", label: "Not now", variant: "ghost" });

        const id = pushAssistant(text, actions);
        plansRef.current.set(id, { matched, top });
      } catch (error) {
        unstable_rethrow(error);
        pushAssistant(ERROR_MESSAGE.failed);
      }
    });
  }

  function handleAction(messageId: string, actionKey: string) {
    if (actionKey === "cancel") {
      pushAssistant("No worries — tell me what you'd like instead.");
      return;
    }
    const plan = plansRef.current.get(messageId);
    if (!plan) return;
    const targets =
      actionKey === "confirm-top" ? plan.top : plan.matched.length > 0 ? plan.matched : plan.top;
    if (targets.length === 0) return;
    generate(targets);
  }

  function generate(targets: PlanTarget[]) {
    setPendingLabel("Generating test code…");
    startBusy(async () => {
      try {
        const result = await generatePlannedTests(
          projectRef,
          targets.map((t) => t.filePath)
        );
        if (!result.ok) {
          pushAssistant(ERROR_MESSAGE[result.reason]);
          return;
        }
        const failedNote =
          result.failed.length > 0
            ? ` Couldn't generate ${result.failed.length} (${result.failed.join(", ")}) — try those again.`
            : "";
        const introText = `Generated ${result.generated} test file${result.generated > 1 ? "s" : ""}.${failedNote} Opening the session now…`;
        const transcript: ChatMessage[] = [
          ...messages,
          { id: uid(), role: "assistant", text: introText },
        ];
        // 대화를 배치의 모든 세션에 영구 저장한 뒤 이동한다 — 사이드바에서 어느 세션을 열어도
        // 세션 상세가 DB 에서 읽어 같은 대화를 이어 보여준다.
        const stored = transcript.map(({ id, role, text }) => ({ id, role, text }));
        await Promise.all(
          result.versionIds.map((versionId) => saveRecommendChat(projectRef, versionId, stored))
        );
        // 배치로 만든 버전을 전부 tests 쿼리로 넘겨 탭으로 보여준다. 생성 직후에는 실행하지 않는다.
        const tests = result.versionIds.join(",");
        router.push(`/project/${projectRef}/recommend/${result.versionId}?tests=${tests}`);
      } catch (error) {
        unstable_rethrow(error);
        pushAssistant(ERROR_MESSAGE.failed);
      }
    });
  }

  return (
    <ChatThread
      messages={messages}
      pending={busy}
      pendingLabel={pendingLabel}
      onSend={submit}
      onAction={handleAction}
      disabled={busy}
      placeholder="Describe which component you need tests for…"
      listClassName="flex-1 min-h-0 overflow-y-auto"
      containerClassName="flex min-h-0 flex-1 flex-col"
    />
  );
}
