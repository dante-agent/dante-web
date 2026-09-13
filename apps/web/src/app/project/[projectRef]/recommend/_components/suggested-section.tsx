"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import type {
  RecommendationOutcome,
  AiRecommendationResult,
} from "@/lib/projects/ai-recommendations";
import type { TestRecommendation } from "@/lib/projects/recommendations";
import { rerankRecommendations } from "../actions";
import { SuggestedList } from "./suggested-list";

// "initial" = 아직 버튼을 안 눌러 휴리스틱만 본 상태. 나머지는 액션이 준 outcome.
// "failed"  = 액션 자체가 예외로 죽은 경우(권한·네트워크 등 폴백조차 못 한 상황).
type Status = "initial" | RecommendationOutcome | "failed";

const MESSAGE: Record<Status, { text: string; tone: "muted" | "ok" | "warn" | "error" }> = {
  initial: { text: "경로 이름으로 정렬된 목록입니다.", tone: "muted" },
  ranked: { text: "AI 가 우선순위를 다시 매겼습니다.", tone: "ok" },
  budget: { text: "이번 달 AI 예산을 초과해 정렬을 건너뛰었습니다.", tone: "warn" },
  error: { text: "AI 정렬에 실패했습니다. API 키·설정을 확인해주세요.", tone: "error" },
  failed: { text: "AI 정렬을 실행하지 못했습니다. 잠시 후 다시 시도해주세요.", tone: "error" },
};

const TONE_CLASS: Record<"muted" | "ok" | "warn" | "error", string> = {
  muted: "text-muted-foreground",
  ok: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-500",
  error: "text-destructive",
};

/**
 * 추천 목록 + "AI 로 정렬" 버튼.
 *
 * 처음 뜨는 목록(initial)은 서버가 경로 휴리스틱으로 공짜로 만든 것이다. 버튼을
 * 누르면 서버 액션이 결과와 함께 outcome 을 돌려주고, 화면은 그 outcome 으로
 * 성공·예산초과·실패를 구분해 안내한다. 실패해도 목록은 휴리스틱으로 유지된다.
 */
export function SuggestedSection({
  projectRef,
  initial,
}: {
  projectRef: string;
  initial: TestRecommendation[];
}) {
  const [recommendations, setRecommendations] = useState(initial);
  const [status, setStatus] = useState<Status>("initial");
  const [pending, startTransition] = useTransition();

  function rerank() {
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

  const message = MESSAGE[status];
  const isError = message.tone === "error" || message.tone === "warn";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className={`flex items-center gap-1.5 text-xs ${TONE_CLASS[message.tone]}`}>
          {isError && <AlertTriangle className="size-3.5 shrink-0" />}
          {message.text}
        </p>
        <button
          type="button"
          onClick={rerank}
          disabled={pending}
          className="border-border hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {pending ? "정렬 중..." : "AI 로 정렬"}
        </button>
      </div>
      <SuggestedList projectRef={projectRef} recommendations={recommendations} />
    </div>
  );
}
