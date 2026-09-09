"use client";

import { useActionState, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import {
  deleteApiKey,
  updateApiKey,
  type KeyState,
} from "@/app/project/[projectRef]/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_PROVIDERS, type AiProvider, type AiProviderId } from "@/lib/projects/ai-providers";

// 설정의 API 키 섹션. 온보딩과 달리 여기서는 세 줄을 늘 펼쳐 둔다 — 고르는
// 화면이 아니라 상태를 보는 화면이고, "지금 무슨 키가 들어있나"가 한눈에
// 보여야 하기 때문이다.

export function ApiKeySettings({
  projectRef,
  savedKeys,
}: {
  projectRef: string;
  savedKeys: Partial<Record<AiProviderId, string>>;
}) {
  return (
    <div className="border-border divide-border divide-y border">
      {AI_PROVIDERS.map((provider) => (
        <ProviderRow
          key={provider.id}
          projectRef={projectRef}
          provider={provider}
          lastFour={savedKeys[provider.id]}
        />
      ))}
    </div>
  );
}

function ProviderRow({
  projectRef,
  provider,
  lastFour,
}: {
  projectRef: string;
  provider: AiProvider;
  lastFour?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [state, formAction, pending] = useActionState(updateApiKey, null);

  // 액션은 프로바이더마다 따로 걸리지만 상태는 한 줄에 하나뿐이라,
  // 다른 줄의 결과가 흘러들어오지 않게 provider 를 대조한다.
  const result: KeyState = state?.provider === provider.id ? state : null;

  // 저장에 성공하면 입력 상태를 닫는다. 화면의 lastFour 는 서버가 다시 그려준다.
  if (result?.saved && editing) {
    setEditing(false);
    setApiKey("");
  }

  return (
    <div className="p-5">
      <div className="flex items-baseline gap-3">
        <span className="font-heading text-base leading-tight font-medium">{provider.name}</span>
        <span className="text-muted-foreground flex-1 text-[13px]">{provider.vendor}</span>

        {lastFour ? (
          <span className="text-brand-mint font-mono text-[10px] font-bold tracking-[0.12em]">
            ····{lastFour}
          </span>
        ) : (
          <span className="text-muted-foreground/70 font-mono text-[10px] tracking-[0.12em]">
            NOT SET
          </span>
        )}

        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground text-[13px] underline underline-offset-4 transition-colors duration-[180ms] ease-out"
          >
            {lastFour ? "Replace" : "Add"}
          </button>
        )}
      </div>

      {/* 저장 직후의 확인. 입력란이 닫히면서 아무 반응이 없으면 눌린 건지 모른다. */}
      {result?.saved && !editing && (
        <p className="text-brand-mint mt-2 flex items-center gap-1.5 text-[13px]">
          <Check className="size-3.5" />
          Saved
        </p>
      )}

      {editing && (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="projectRef" value={projectRef} />
          <input type="hidden" name="provider" value={provider.id} />

          <div className="relative">
            <Input
              name="apiKey"
              type={revealed ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              placeholder={provider.placeholder}
              aria-label={`${provider.vendor} API key`}
              aria-invalid={result?.error ? true : undefined}
              className="h-10 rounded-[4px] pr-10 font-mono text-[13px]"
            />
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? "Hide API key" : "Show API key"}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center transition-colors duration-[180ms] ease-out"
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {result?.error && (
            <p role="alert" className="text-destructive mt-2 text-[13px]">
              {result.error}
            </p>
          )}

          <p className="text-muted-foreground mt-2 text-[13px]">
            <a
              href={provider.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground underline underline-offset-4 transition-colors duration-[180ms] ease-out"
            >
              Create a key in the {provider.vendor} console
            </a>
          </p>

          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm" disabled={pending} className="rounded-[4px]">
              {pending ? "Checking..." : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setApiKey("");
              }}
              className="rounded-[4px]"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* 지우기는 별도 form. 위 form 안에 두면 제출이 엇갈린다. */}
      {lastFour && !editing && (
        <form action={deleteApiKey} className="mt-3">
          <input type="hidden" name="projectRef" value={projectRef} />
          <input type="hidden" name="provider" value={provider.id} />
          <button
            type="submit"
            className="text-muted-foreground hover:text-destructive text-[13px] underline underline-offset-4 transition-colors duration-[180ms] ease-out"
          >
            Remove key
          </button>
        </form>
      )}
    </div>
  );
}
