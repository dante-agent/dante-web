"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { Check } from "lucide-react";
import {
  saveRuntimeSettings,
  type SaveState,
} from "@/app/project/[projectRef]/settings/runtime/actions";
import { Button } from "@/components/ui/button";
import { TIMEOUT_CHOICES } from "@/lib/projects/runtime";

// 실행 환경 폼. 샌드박스가 레포를 클론한 뒤 순서대로 돌릴 명령이다.
//
// 커맨드를 자유 입력으로 둔 이유: 패키지 매니저·모노레포 구조·워크스페이스
// 필터가 레포마다 달라서, 고르는 목록으로는 절반도 못 덮는다. 잘못 적으면
// 격리된 샌드박스 안에서 실패할 뿐이고, 그 로그가 화면에 그대로 나온다.

export function RuntimeForm({
  projectRef,
  initial,
  placeholders,
}: {
  projectRef: string;
  initial: { installCommand: string; testCommand: string; timeoutMs: number };
  /** 비워두면 무엇이 돌게 되는지 보여준다 — 러너에 따라 다르다. */
  placeholders: { install: string; test: string };
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    saveRuntimeSettings,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="projectRef" value={projectRef} />

      <Section
        title="Commands"
        description="Run in the cloned repository, in this order. Leave a field empty to fall back to the default shown."
      >
        <CommandField
          name="installCommand"
          label="Install"
          hint="Runs first. If it fails the run stops here and is reported as an error, not a test failure."
          defaultValue={initial.installCommand}
          placeholder={placeholders.install}
        />
        <CommandField
          name="testCommand"
          label="Test"
          hint="Its exit code decides pass or fail. Anything it prints becomes the run log."
          defaultValue={initial.testCommand}
          placeholder={placeholders.test}
          last
        />
      </Section>

      <Section
        title="Timeout"
        description="How long a single run may take before the sandbox is torn down. Each command gets this budget."
      >
        <label className="block p-4">
          <span className="block text-[13px] leading-tight">Maximum run time</span>
          <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">
            Longer runs cost more — you are billed for the time the sandbox is up.
          </span>
          <select
            name="timeoutMs"
            defaultValue={String(initial.timeoutMs)}
            className="border-border bg-background mt-3 border p-2 text-[13px]"
          >
            {TIMEOUT_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <div className="mt-4 flex max-w-2xl items-center gap-3">
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

/**
 * 제목 + 테두리 한 칸. 알림 설정에도 같은 모양이 있지만 거기서 끌어오지 않는다 —
 * GitHub 설정도 제 몫을 따로 두고 있고(`SectionLabel`), 설정 화면끼리 컴포넌트를
 * 주고받기 시작하면 한쪽을 고칠 때 다른 쪽이 따라 움직인다.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="font-heading text-[15px] leading-tight font-medium">{title}</h2>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{description}</p>
      <div className="border-border bg-card mt-3 border">{children}</div>
    </section>
  );
}

function CommandField({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
  last,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  placeholder: string;
  last?: boolean;
}) {
  return (
    <label className={last ? "block p-4" : "border-border block border-b p-4"}>
      <span className="block text-[13px] leading-tight">{label}</span>
      <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">{hint}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="border-border bg-background mt-3 w-full border p-2 font-mono text-[12px]"
      />
    </label>
  );
}
