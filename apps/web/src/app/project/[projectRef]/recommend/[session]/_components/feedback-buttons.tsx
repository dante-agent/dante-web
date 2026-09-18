"use client";

import { useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRecommendFeedback } from "../../actions";

type Feedback = "up" | "down" | null;

// 세션 결과 품질에 대한 👍/👎. 같은 값을 다시 누르면 해제된다. 낙관적으로 갱신하고 실패하면 되돌린다.
export function FeedbackButtons({
  projectRef,
  versionId,
  initial,
}: {
  projectRef: string;
  versionId: string;
  initial: Feedback;
}) {
  const [value, setValue] = useState<Feedback>(initial);
  const [, startTransition] = useTransition();

  function vote(next: Exclude<Feedback, null>) {
    const target: Feedback = value === next ? null : next;
    const prev = value;
    setValue(target); // 낙관적
    startTransition(async () => {
      const result = await setRecommendFeedback(projectRef, versionId, target);
      if (!result.ok) setValue(prev); // 실패 시 롤백
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => vote("up")}
        aria-pressed={value === "up"}
        aria-label="Helpful"
        className={cn(
          "hover:text-foreground rounded p-1 transition-colors",
          value === "up" ? "text-brand-mint" : "text-muted-foreground"
        )}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => vote("down")}
        aria-pressed={value === "down"}
        aria-label="Not helpful"
        className={cn(
          "hover:text-foreground rounded p-1 transition-colors",
          value === "down" ? "text-brand-orange" : "text-muted-foreground"
        )}
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </div>
  );
}
