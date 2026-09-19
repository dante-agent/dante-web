"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { Check } from "lucide-react";
import {
  saveRuntimeSettings,
  type SaveState,
} from "@/app/project/[projectRef]/settings/runtime/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectFieldLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEOUT_CHOICES, type RuntimeCommands } from "@/lib/projects/runtime";

// Select 는 값을 문자열로 주고받는다. 폼에 실릴 때도 문자열이라 서버에서 Number() 로 되돌린다.
const TIMEOUT_OPTIONS = TIMEOUT_CHOICES.map((choice) => ({
  value: String(choice.value),
  label: choice.label,
}));

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
  /** 비워두면 무엇이 돌게 되는지 보여준다. 레포에서 알아낸 값일 수도, 아닐 수도 있다. */
  placeholders: RuntimeCommands;
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
        description={
          placeholders.source === "repo"
            ? "Run in the cloned repository, in this order. The defaults come from your lockfile and package.json — leave a field empty to go back to them."
            : "Run in the cloned repository, in this order. We could not read your repository, so these defaults are generic ones — check they match how your project actually installs and tests."
        }
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
        <div className="p-4">
          {/* 네이티브 <select> 를 쓰다가 교체했다. OS 가 화살표를 그려 좌우 여백이
              어긋나고, 열리는 메뉴도 브라우저 기본이라 화면과 따로 논다. 알림 설정의
              스누즈 선택기(snooze-control.tsx)와 같은 것을 쓴다. name 을 주면 Base UI 가
              숨은 input 을 만들어 폼에 값이 실린다. pr-2.5 는 기본값(pl-2.5 / pr-2)의
              좌우 여백을 같게 맞춘다. */}
          <Select name="timeoutMs" defaultValue={String(initial.timeoutMs)} items={TIMEOUT_OPTIONS}>
            <SelectFieldLabel className="block text-[13px] leading-tight">
              Maximum run time
            </SelectFieldLabel>
            <span
              id="timeout-hint"
              className="text-muted-foreground mt-1 block text-[12px] leading-relaxed"
            >
              Longer runs cost more — you are billed for the time the sandbox is up.
            </span>
            <SelectTrigger
              aria-describedby="timeout-hint"
              size="sm"
              className="mt-3 w-28 pr-2.5 text-[13px] data-[size=sm]:rounded-[4px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
              {TIMEOUT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
