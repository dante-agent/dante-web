"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { saveAiChatStyle, type SaveState } from "@/app/account/settings/actions";
import { useAnnounce } from "@/components/live-announcer";
import { Button } from "@/components/ui/button";
import {
  AI_PERSONA_OPTIONS,
  AI_PERSONAS,
  MAX_AI_INSTRUCTIONS,
  type AiPersona,
} from "@/lib/ai/persona";

// 채팅 스타일. 프리셋 카드는 생성 품질(quality-form.tsx)과 같은 모양이고,
// 지시문은 그 아래 한 칸이다. 둘은 같이 프롬프트에 들어가서 저장도 한 번에 한다.

export function AiChatStyleForm({
  initial,
}: {
  initial: { persona: AiPersona; instructions: string | null };
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveAiChatStyle, null);
  // "Saved" 는 조건부로 나타나서 스크린리더가 놓친다. 제출마다 새 state 라 연달아 저장해도 다시 읽힌다.
  useAnnounce(state?.saved ? "Saved" : null, state);
  const [length, setLength] = useState(initial.instructions?.length ?? 0);

  return (
    <form action={formAction}>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Chat style</legend>
        {AI_PERSONAS.map((persona) => (
          <label
            key={persona}
            className="group border-border bg-card hover:border-input block cursor-pointer border p-5 transition-colors duration-[180ms] ease-out has-[:checked]:border-[#ff570a] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#ff570a]/40"
          >
            <input
              type="radio"
              name="persona"
              value={persona}
              defaultChecked={initial.persona === persona}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2 text-[14px] leading-tight font-medium">
              {AI_PERSONA_OPTIONS[persona].label}
              <Check
                aria-hidden="true"
                className="text-brand-orange hidden size-4 shrink-0 group-has-[:checked]:block"
              />
            </span>
            <span className="text-muted-foreground mt-2 block text-[13px] leading-relaxed">
              {AI_PERSONA_OPTIONS[persona].description}
            </span>
          </label>
        ))}
      </fieldset>

      {/* 이름은 제목만, 긴 안내는 aria-describedby 로 — label 이 안내까지 감싸면 이름이 문단이 된다. */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="ai-instructions" className="text-[13px] font-medium">
            Custom instructions
          </label>
          <span
            className={`font-mono text-[11px] ${length > MAX_AI_INSTRUCTIONS ? "text-destructive" : "text-muted-foreground"}`}
          >
            {length}/{MAX_AI_INSTRUCTIONS}
          </span>
        </div>
        <p
          id="ai-instructions-hint"
          className="text-muted-foreground mt-1 text-[12px] leading-relaxed"
        >
          Added to every chat answer. For example: answer in Korean, name tests in plain sentences,
          prefer userEvent over fireEvent. It can&apos;t change what the chat is allowed to do.
        </p>
        <textarea
          id="ai-instructions"
          aria-describedby="ai-instructions-hint"
          name="instructions"
          defaultValue={initial.instructions ?? ""}
          maxLength={MAX_AI_INSTRUCTIONS}
          onChange={(e) => setLength(e.target.value.length)}
          rows={5}
          className="border-border bg-background mt-3 w-full resize-y border p-3 text-[13px] leading-relaxed"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          focusableWhenDisabled
          className="rounded-[4px]"
        >
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
