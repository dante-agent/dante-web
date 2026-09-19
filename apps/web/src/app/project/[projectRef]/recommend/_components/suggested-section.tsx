"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ListChecks, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  RecommendationOutcome,
  AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import { useAnnounce } from "@/components/live-announcer";
import type { TestRecommendation } from "@/lib/projects/recommendations";
import { cn } from "@/lib/utils";
import { rerankRecommendations } from "../actions";
import { generateHref } from "./generate-test-button";
import { MAX_SELECT, SuggestedList } from "./suggested-list";

// "initial" = 아직 버튼을 안 눌러 휴리스틱만 본 상태. 나머지는 액션이 준 outcome.
// "failed"  = 액션 자체가 예외로 죽은 경우(권한·네트워크 등 폴백조차 못 한 상황).
type Status = "initial" | RecommendationOutcome | "failed";

const MESSAGE: Record<Status, { text: string; tone: "muted" | "ok" | "warn" | "error" }> = {
  initial: { text: "", tone: "muted" },
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

/**
 * 추천 목록 + "AI 로 정렬" + 여러 개를 골라 한 번에 만드는 배치 생성.
 *
 * 처음 뜨는 목록(initial)은 서버가 점수로 공짜로 만든 것이다. "Sort with AI"는
 * 재정렬만 한다. Select 를 켜면 카드의 화살표가 체크박스로 바뀌고, 목록 아래 시트에서
 * 고른 파일들을 생성 화면(/recommend/generate)으로 한 번에 넘긴다.
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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function rerank() {
    if (pending) return;
    startTransition(async () => {
      try {
        const result: AiRecommendationResult = await rerankRecommendations(projectRef);
        setRecommendations(result.recommendations);
        setStatus(result.outcome);
      } catch {
        // 액션이 폴백조차 못 하고 죽은 경우 — 목록은 그대로 두고 실패만 알린다.
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

  const remaining = MAX_SELECT - selected.size;

  // Esc 로 선택을 전부 푼다 — 체크를 하나씩 되돌리지 않아도 되게.
  useEffect(() => {
    if (selected.size === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(new Set());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected.size]);

  const message = MESSAGE[status];
  const isError = message.tone === "error" || message.tone === "warn";

  // 정렬 결과 문구와 선택 개수는 화면 글자만 바뀌어서 스크린리더용으로 따로 알린다.
  // 정렬은 끝났을 때(pending 이 풀릴 때)마다, 개수는 고를 때마다.
  useAnnounce(pending ? null : message.text, pending);
  useAnnounce(selectMode ? `${selected.size} of ${MAX_SELECT} selected` : null, selected);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {/* 섹션 이름은 패널 안 머리줄이 들고 있다 — 카드 밖에 또 두면 같은 말이 두 번 나온다. */}
        <h2 className="text-foreground text-[15px] font-medium tracking-[-0.01em]">Suggested</h2>
        {message.text && (
          <p className={`flex items-center gap-1.5 text-xs ${TONE_CLASS[message.tone]}`}>
            {isError && <AlertTriangle className="size-3.5 shrink-0" />}
            {message.text}
          </p>
        )}
        <span className="ml-auto flex items-center gap-2">
          {/* 선택 모드 토글. 라벨 길이가 고정이라 켜고 꺼도 폭이 흔들리지 않는다. */}
          <button
            type="button"
            aria-pressed={selectMode}
            onClick={() => {
              setSelectMode((prev) => !prev);
              setSelected(new Set());
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              selectMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <ListChecks className="size-3.5" />
            Select
          </button>
          <button
            type="button"
            onClick={rerank}
            // 정렬 중에도 포커스가 버튼에 남게 aria-disabled. 중복 실행은 rerank() 가 막는다.
            aria-disabled={pending}
            className="border-border hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium aria-disabled:opacity-50"
          >
            <Sparkles className="size-3.5" />
            {pending ? "Sorting..." : "Sort with AI"}
          </button>
        </span>
      </div>

      <SuggestedList
        projectRef={projectRef}
        recommendations={recommendations}
        selectMode={selectMode}
        selected={selected}
        onToggle={toggle}
        selectionFull={selected.size >= MAX_SELECT}
      />

      {/* 목록 아래에 두고 sticky 로 붙인다 — 목록 위에 끼워 넣으면 고른 줄이 손가락 밑에서 밀리고,
          스크롤하면 실행 버튼이 화면 밖으로 나간다. 선택 모드에 들어가면 0개일 때부터 떠 있어,
          무엇을 하는 모드인지(몇 개까지 고를 수 있는지) 고르기 전에 알 수 있다. */}
      {selectMode && (
        <div className="animate-in fade-in slide-in-from-bottom-1 sticky bottom-4 z-10 my-1 duration-200">
          <div className="border-border bg-card flex flex-col rounded-lg border shadow-lg">
            <div className="flex flex-wrap items-center gap-3 py-3 pr-2 pl-3.5">
              <span className="text-muted-foreground text-xs tabular-nums">
                <span className="text-foreground font-medium">{selected.size}</span> of {MAX_SELECT}{" "}
                selected
                <span className="text-muted-foreground block text-[11px]">
                  {selected.size === 0
                    ? `Pick up to ${MAX_SELECT} files`
                    : remaining === 0
                      ? "Maximum reached"
                      : `${remaining} more can be added`}
                </span>
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  disabled={selected.size === 0}
                  className="text-muted-foreground hover:text-foreground px-2 text-xs disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={generateSelected}
                  disabled={selected.size === 0}
                  className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  Generate tests
                  {/* 개수를 라벨 밖 배지로 뺀다 — 라벨 안에 넣으면 고를 때마다 버튼 폭이 흔들린다. */}
                  <span className="bg-primary-foreground/20 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] tabular-nums">
                    {selected.size}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
