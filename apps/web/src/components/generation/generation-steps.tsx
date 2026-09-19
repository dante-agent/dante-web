"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useAnnounce } from "@/components/live-announcer";
import { cn } from "@/lib/utils";
import type { Stage } from "./use-generation-performance";

const ORDER = ["read", "send", "write", "open"] as const;

/** 생성 연출의 단계 목록. 지난 단계는 체크, 지금 단계는 스피너, 남은 단계는 흐리게.
 * 스크린리더에는 단계마다 sr-only 상태 글자를 붙이고, 지금 단계 이름만 공용 알림으로 읽는다
 * (목록 전체를 aria-live 로 두면 바뀔 때마다 네 줄을 다 읽는다). */
export function GenerationSteps({
  stage,
  finalLabel,
}: {
  stage: Stage;
  /** 마지막 단계 이름 — 생성 뒤에 하는 일(세션으로 이동, 화면 새로고침 등). */
  finalLabel: string;
}) {
  const labels = ["Reading source", "Sending to AI", "Writing tests", finalLabel];
  const current = stage === "error" ? -1 : ORDER.indexOf(stage);
  useAnnounce(current >= 0 ? labels[current] : null);

  return (
    <ol className="flex flex-col gap-1.5" aria-label="Progress">
      {labels.map((label, index) => {
        const state =
          current < 0 ? "idle" : index < current ? "done" : index === current ? "active" : "idle";
        return (
          <li
            key={label}
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              state === "idle" ? "text-muted-foreground" : "text-foreground/90"
            )}
          >
            {state === "done" ? (
              <Check className="text-brand-mint size-3.5 shrink-0" />
            ) : state === "active" ? (
              <LoaderCircle className="text-brand-cobalt size-3.5 shrink-0 animate-spin" />
            ) : (
              <span className="border-muted-foreground/40 size-3.5 shrink-0 rounded-full border" />
            )}
            {label}
            <span className="sr-only">
              {state === "done" ? ", done" : state === "active" ? ", in progress" : ", not started"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
