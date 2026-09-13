"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { saveAiQuality, type SaveState } from "@/app/account/settings/actions";
import { Button } from "@/components/ui/button";
import { AI_QUALITIES, AI_QUALITY_OPTIONS, type AiQuality } from "@/lib/ai/quality";

// 생성 품질 기본값. 카드 두 장짜리 라디오는 온보딩 프레임워크 선택과 같은 모양이다.

export function AiQualityForm({ initial }: { initial: AiQuality }) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveAiQuality, null);

  return (
    <form action={formAction}>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Generation quality</legend>
        {AI_QUALITIES.map((quality) => (
          <label
            key={quality}
            className="border-border bg-card hover:border-input block cursor-pointer border p-5 transition-colors duration-[180ms] ease-out has-[:checked]:border-[#ff570a] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#ff570a]/40"
          >
            <input
              type="radio"
              name="quality"
              value={quality}
              defaultChecked={initial === quality}
              className="sr-only"
            />
            <span className="block text-[14px] leading-tight font-medium">
              {AI_QUALITY_OPTIONS[quality].label}
            </span>
            <span className="text-muted-foreground mt-2 block text-[13px] leading-relaxed">
              {AI_QUALITY_OPTIONS[quality].description}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending} className="rounded-[4px]">
          {pending ? "Saving..." : "Save"}
        </Button>
        {state?.saved && (
          <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
            <Check className="size-3.5" />
            Saved
          </span>
        )}
        {state?.error && (
          <span role="alert" className="text-destructive text-[13px]">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
