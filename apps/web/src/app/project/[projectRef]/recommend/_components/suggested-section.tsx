"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ListChecks, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  RecommendationOutcome,
  AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import type { TestRecommendation } from "@/lib/projects/recommendations";
import { rerankRecommendations } from "../actions";
import { generateHref } from "./generate-test-button";
import { PanelHeader } from "./panel-header";
import { SuggestedList } from "./suggested-list";

// "initial" = 아직 버튼을 안 눌러 휴리스틱만 본 상태. 나머지는 액션이 준 outcome.
// "failed"  = 액션 자체가 예외로 죽은 경우(권한·네트워크 등 폴백조차 못 한 상황).
type Status = "initial" | RecommendationOutcome | "failed";

const MESSAGE: Record<Status, { text: string; tone: "muted" | "ok" | "warn" | "error" }> = {
  initial: { text: "Sorted by path name.", tone: "muted" },
  ranked: { text: "AI re-prioritized the list.", tone: "ok" },
  budget: { text: "Exceeded this month's AI budget, so sorting was skipped.", tone: "warn" },
  error: { text: "AI sorting failed. Check your API key and settings.", tone: "error" },
  failed: { text: "Couldn't run AI sorting. Please try again in a moment.", tone: "error" },
};

const TONE_CLASS: Record<"muted" | "ok" | "warn" | "error", string> = {
  muted: "text-muted-foreground",
  ok: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-500",
  error: "text-destructive",
};

/** 한 번에 배치 생성할 수 있는 최대 개수(서버 MAX_MATCHES 와 맞춘다). */
const MAX_SELECT = 3;

/**
 * 추천 목록 + "AI 로 정렬" + 여러 개를 골라 한 번에 만드는 배치 생성.
 *
 * 처음 뜨는 목록(initial)은 서버가 경로 휴리스틱으로 공짜로 만든 것이다. "Sort with AI"는
 * 재정렬만 하고, 카드를 체크해 "Generate selected"를 누르면 생성 화면(/recommend/generate)으로
 * 넘어가 한 번에 만든 뒤 세션(탭)으로 이동한다.
 */
export function SuggestedSection({
  projectRef,
  initial,
}: {
  projectRef: string;
  initial: TestRecommendation[];
}) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState(initial);
  const [status, setStatus] = useState<Status>("initial");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function rerank() {
    startTransition(async () => {
      try {
        const result: AiRecommendationResult = await rerankRecommendations(projectRef);
        setRecommendations(result.recommendations);
        setStatus(result.outcome);
      } catch {
        setStatus("failed");
      }
    });
  }

  function toggle(filePath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else if (next.size < MAX_SELECT) next.add(filePath);
      return next;
    });
  }

  // 생성 화면이 요청·연출·오류 표시를 맡는다. 여기선 고른 파일들을 넘겨 이동만 한다.
  function generateSelected() {
    if (selected.size === 0) return;
    router.push(generateHref(projectRef, [...selected]));
  }

  const message = MESSAGE[status];
  const isError = message.tone === "error" || message.tone === "warn";

  return (
    <>
      <PanelHeader
        icon={ListChecks}
        title="Suggested"
        action={
          <button
            type="button"
            onClick={rerank}
            disabled={pending}
            className="border-border hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            <Sparkles className="size-3.5" />
            {pending ? "Sorting..." : "Sort with AI"}
          </button>
        }
      />
      <p className={`flex items-center gap-1.5 text-xs ${TONE_CLASS[message.tone]}`}>
        {isError && <AlertTriangle className="size-3.5 shrink-0" />}
        {message.text}
      </p>

      {selected.size > 0 && (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span className="text-muted-foreground text-xs">
            {selected.size} selected{selected.size >= MAX_SELECT ? ` (max ${MAX_SELECT})` : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={generateSelected}
              className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <Sparkles className="size-3.5" />
              Generate {selected.size} selected
            </button>
          </div>
        </div>
      )}

      <SuggestedList
        projectRef={projectRef}
        recommendations={recommendations}
        selected={selected}
        onToggle={toggle}
        selectionFull={selected.size >= MAX_SELECT}
      />
    </>
  );
}
