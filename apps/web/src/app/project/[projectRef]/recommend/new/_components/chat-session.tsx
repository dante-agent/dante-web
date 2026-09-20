"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { requestArrivalFocus } from "@/components/generation/arrival-focus";
import { GenerationSteps } from "@/components/generation/generation-steps";
import { SendingFiles } from "@/components/generation/sending-files";
import { useGenerationPerformance } from "@/components/generation/use-generation-performance";
import { ResizableSplit } from "../../[session]/_components/resizable-split";
import { WritingCode } from "../../generate/_components/writing-code";
import {
  generatePlannedTests,
  planTestGeneration,
  saveRecommendChat,
  type GeneratedTestFile,
  type PlanTarget,
  type PromptGenerateResult,
  type TestPlanResult,
} from "../../actions";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";

type FailReason =
  | Extract<TestPlanResult, { ok: false }>["reason"]
  | Extract<PromptGenerateResult, { ok: false }>["reason"]
  | "failed";

// 예산 한도는 팀이 아니라 사람마다이고 매달 1일 초기화된다 — 문구에 그대로 밝힌다.
// 사용자는 AI 제공자 키를 넣지 않으므로(Dante 가 제공자와 직접 계약) 실패 문구에서 "API 키
// 확인" 같은 손댈 수 없는 안내는 빼고 다시 시도만 권한다.
const ERROR_MESSAGE: Record<FailReason, string> = {
  budget:
    "You've used up your personal AI budget this month, so tests can't be generated. It resets on the 1st.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
  error: "Test generation failed. Please try again in a moment.",
  failed: "Couldn't run test generation. Please try again in a moment.",
};

const uid = () => crypto.randomUUID();

/** 타이핑이 끝나고 세션으로 넘어가기 전 잠깐 멈춤 — 완성된 코드를 한 번 보여준다. */
const OPEN_DELAY_MS = 600;

/**
 * 프롬프트→계획→추천 사유+생성 확인→생성 의 전체 흐름을 채팅 메시지로 이어 붙인다.
 * 확정되면 생성 화면과 같은 연출(좌측 파일 전송·단계, 우측 코드 타이핑)을 보여주며 generatePlannedTests 로
 * 저장하고, 방금까지의 대화를 만든 세션들(DB)에 심어 실제 세션(/recommend/[session])의 FollowUp 이 이어서
 * 보여줄 수 있게 한 뒤 그리로 이동한다. 좌우 칸이 같은 연출 상태를 보도록 분할 화면 전체를 여기서 그린다.
 */
export function ChatSession({
  projectRef,
  initialPrompt,
  header,
}: {
  projectRef: string;
  initialPrompt: string;
  /** 좌측 칸 위쪽 줄(레포·제목). 서버 페이지가 넘긴다. */
  header: ReactNode;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, startBusy] = useTransition();
  const [pendingLabel, setPendingLabel] = useState("Finding matching files…");
  // 확인 메시지 id → 그 시점에 세운 계획(확정 시 어떤 파일을 생성할지). 액션 버튼 클릭 때 꺼내 쓴다.
  const plansRef = useRef(new Map<string, { matched: PlanTarget[]; top: PlanTarget[] }>());
  const startedRef = useRef(false);
  // 생성이 도는 중인지. 확정 버튼의 disabled 는 재렌더 뒤에야 걸려서, 그 사이 더블클릭이면
  // generate 가 두 번 돌아 배치가 이중 생성·이중 과금될 수 있다. 이 래치로 두 번째를 버린다.
  const generatingRef = useRef(false);
  // 생성 연출. 확정한 대상 파일과, 연출이 끝난 뒤 이동할 주소·대화 저장 완료를 들고 있다.
  const [chosenTargets, setChosenTargets] = useState<PlanTarget[]>([]);
  const afterRef = useRef({ url: "", saved: Promise.resolve() as Promise<unknown> });
  const finish = useCallback(async () => {
    const { saved, url } = afterRef.current;
    await Promise.all([
      saved.catch(() => undefined),
      new Promise((r) => setTimeout(r, OPEN_DELAY_MS)),
    ]);
    requestArrivalFocus();
    router.push(url);
    // 좌측 사이드바는 레이아웃이라 이동만으로는 다시 그리지 않는다. 새 세션이 목록에 뜨게 새로고침한다.
    router.refresh();
  }, [router]);
  const performance = useGenerationPerformance<GeneratedTestFile>({ finish });
  const { stage } = performance;
  const generating = stage !== null && stage !== "error";

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

  function generate(chosen: PlanTarget[]) {
    // 이미 생성이 도는 중이면(더블클릭) 두 번째 호출을 버린다. 실패로 끝나면 아래에서 풀어
    // 같은 버튼으로 재시도할 수 있게 한다. 성공하면 세션으로 이동하므로 풀 필요가 없다.
    if (generatingRef.current) return;
    generatingRef.current = true;
    setChosenTargets(chosen);
    performance.start(async () => {
      try {
        const result = await generatePlannedTests(
          projectRef,
          chosen.map((t) => t.filePath)
        );
        if (!result.ok) {
          generatingRef.current = false;
          pushAssistant(ERROR_MESSAGE[result.reason]);
          return { ok: false, message: ERROR_MESSAGE[result.reason] };
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
        // 대화를 배치의 모든 세션에 영구 저장한다(연출과 겹쳐서) — 사이드바에서 어느 세션을 열어도
        // 세션 상세가 DB 에서 읽어 같은 대화를 이어 보여준다. 이동 전에 끝났는지만 기다린다.
        const stored = transcript.map(({ id, role, text }) => ({ id, role, text }));
        // 배치로 만든 버전을 전부 tests 쿼리로 넘겨 탭으로 보여준다. 생성 직후에는 실행하지 않는다.
        const tests = result.versionIds.join(",");
        afterRef.current = {
          url: `/project/${projectRef}/recommend/${result.versionId}?tests=${tests}`,
          saved: Promise.all(
            result.versionIds.map((versionId) => saveRecommendChat(projectRef, versionId, stored))
          ),
        };
        return { ok: true, files: result.files };
      } catch (error) {
        generatingRef.current = false;
        unstable_rethrow(error);
        pushAssistant(ERROR_MESSAGE.failed);
        return { ok: false, message: ERROR_MESSAGE.failed };
      }
    });
  }

  const paths = chosenTargets.map((t) => t.filePath);

  return (
    <ResizableSplit
      left={
        <section className="border-border bg-background flex min-w-0 flex-1 flex-col border-r">
          {header}
          <ChatThread
            messages={messages}
            pending={busy || generating}
            pendingLabel={pendingLabel}
            pendingContent={
              generating &&
              stage && (
                <div className="flex flex-col gap-3">
                  <SendingFiles files={paths} stage={stage} />
                  <GenerationSteps stage={stage} finalLabel="Opening session" />
                </div>
              )
            }
            onSend={submit}
            onAction={handleAction}
            disabled={busy || generating}
            placeholder="Describe which component you need tests for…"
            listClassName="flex-1 min-h-0 overflow-y-auto"
            containerClassName="flex min-h-0 flex-1 flex-col"
          />
        </section>
      }
      right={
        generating ? (
          <WritingCode
            sources={paths}
            files={performance.files}
            typing={performance.typing}
            waiting={stage === "write" && !performance.files}
            failed={false}
          />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
            Generated test code will appear here once you confirm.
          </div>
        )
      }
    />
  );
}
