"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useId, useState } from "react";
import { Check } from "lucide-react";
import {
  saveRuntimeSettings,
  type SaveState,
} from "@/app/project/[projectRef]/settings/runtime/actions";
import { useAnnounce } from "@/components/live-announcer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectFieldLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEST_FRAMEWORKS, type TestFrameworkId } from "@/lib/projects/frameworks";
import { TIMEOUT_CHOICES, type RuntimeCommands } from "@/lib/projects/runtime";

// Select 는 값을 문자열로 주고받는다. 폼에 실릴 때도 문자열이라 서버에서 Number() 로 되돌린다.
const TIMEOUT_OPTIONS = TIMEOUT_CHOICES.map((choice) => ({
  value: String(choice.value),
  label: choice.label,
}));

const RUNNER_OPTIONS = TEST_FRAMEWORKS.map((framework) => ({
  value: framework.id,
  label: framework.name,
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
  testFramework,
  testDefaults,
}: {
  projectRef: string;
  initial: { installCommand: string; testCommand: string; timeoutMs: number };
  /** 비워두면 무엇이 돌게 되는지 보여준다. 레포에서 알아낸 값일 수도, 아닐 수도 있다. */
  placeholders: RuntimeCommands;
  /** 온보딩에서 고른 러너. 고르지 않고 넘어온 프로젝트면 null. */
  testFramework: TestFrameworkId | null;
  /** 러너별 기본 테스트 명령. 러너를 바꾸면 Test 칸이 이 값을 따라간다. */
  testDefaults: Record<TestFrameworkId, string>;
}) {
  const [runner, setRunner] = useState<string>(testFramework ?? "");
  const [testCommand, setTestCommand] = useState(initial.testCommand);
  // 러너를 바꿀 때 Test 칸이 이전 러너의 기본값 그대로면 새 기본값으로 바꿔 준다.
  // 사용자가 직접 적은 명령은 러너와 상관없이 그대로 둔다.
  const changeRunner = (next: string) => {
    const previousDefault = runner ? testDefaults[runner as TestFrameworkId] : placeholders.test;
    if (testCommand.trim() === "" || testCommand === previousDefault) {
      setTestCommand(testDefaults[next as TestFrameworkId] ?? testCommand);
    }
    setRunner(next);
  };

  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    saveRuntimeSettings,
    null
  );
  // "Saved" 는 조건부로 나타나서 스크린리더가 놓친다. 제출마다 새 state 라 연달아 저장해도 다시 읽힌다.
  useAnnounce(state?.saved ? "Saved" : null, state);
  // 잘못된 칸이 있으면 그 칸으로 포커스를 옮긴다. 오류 문구는 아래 role="alert" 가 읽는다.
  useEffect(() => {
    if (state?.field && state.field !== "timeoutMs") {
      document.querySelector<HTMLElement>(`[name="${state.field}"]`)?.focus();
    }
  }, [state]);
  const invalid = (field: NonNullable<SaveState>["field"]) => state?.field === field;

  return (
    <form action={formAction}>
      <input type="hidden" name="projectRef" value={projectRef} />

      <Section
        title="Test runner"
        description="Decides the imports in the tests Dante writes and the default test command below."
      >
        <div className="p-4">
          <Select
            name="testFramework"
            value={runner}
            onValueChange={(value) => changeRunner(String(value ?? ""))}
            items={RUNNER_OPTIONS}
          >
            <SelectFieldLabel className="block text-[13px] leading-tight">Runner</SelectFieldLabel>
            <span
              id="runner-hint"
              className="text-muted-foreground mt-1 block text-[12px] leading-relaxed"
            >
              Tests already written for the old runner keep its imports. Regenerate them after
              switching, or they will fail under the new one.
            </span>
            <SelectTrigger
              aria-describedby="runner-hint"
              size="sm"
              className="mt-3 w-28 pr-2.5 text-[13px] data-[size=sm]:rounded-[4px]"
            >
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
              {RUNNER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

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
          invalid={invalid("installCommand")}
        />
        <CommandField
          name="testCommand"
          label="Test"
          hint="Its exit code decides pass or fail. Anything it prints becomes the run log."
          value={testCommand}
          onChange={setTestCommand}
          placeholder={runner ? testDefaults[runner as TestFrameworkId] : placeholders.test}
          invalid={invalid("testCommand")}
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
          <span id={RUNTIME_ERROR_ID} role="alert" className="text-destructive text-[13px]">
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

/** 저장 오류 문구의 id. 잘못된 칸이 aria-describedby 로 가리킨다. */
const RUNTIME_ERROR_ID = "runtime-error";

function CommandField({
  name,
  label,
  hint,
  defaultValue,
  value,
  onChange,
  placeholder,
  invalid,
  last,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue?: string;
  /** 러너에 따라 바뀌는 칸만 제어한다. 나머지는 defaultValue 로 둔다. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  /** 서버가 이 칸을 잘못됐다고 돌려보냈나. */
  invalid?: boolean;
  last?: boolean;
}) {
  const id = useId();
  // 이름은 제목만, 긴 안내는 aria-describedby 로 — label 이 안내까지 감싸면 이름이 문단이 된다.
  return (
    <div className={last ? "block p-4" : "border-border block border-b p-4"}>
      <label htmlFor={id} className="block text-[13px] leading-tight">
        {label}
      </label>
      <span
        id={`${id}-hint`}
        className="text-muted-foreground mt-1 block text-[12px] leading-relaxed"
      >
        {hint}
      </span>
      <input
        id={id}
        aria-describedby={invalid ? `${id}-hint ${RUNTIME_ERROR_ID}` : `${id}-hint`}
        aria-invalid={invalid || undefined}
        type="text"
        name={name}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange && ((event) => onChange(event.target.value))}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="border-border bg-background mt-3 w-full border p-2 font-mono text-[12px]"
      />
    </div>
  );
}
