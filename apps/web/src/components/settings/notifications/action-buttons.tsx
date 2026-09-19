"use client";

// 결과를 돌려주지 않는 서버 액션(retryDelivery·setSnooze)을 누르는 버튼들.
// 화면은 서버가 다시 그려 주지만, 스크린리더에는 아무 일도 없었던 것처럼 들린다.
// 그래서 보내는 동안 막고(aria-disabled — 누른 버튼이 포커스를 잃지 않게), 끝나면 공용 알림으로 알린다.
// delivery-log.tsx·snooze.tsx 는 서버 컴포넌트라 이 조각만 클라이언트로 뗐다.

import { useFormStatus } from "react-dom";
import {
  retryDelivery,
  setSnooze,
} from "@/app/project/[projectRef]/settings/notifications/actions";
import { announce } from "@/components/live-announcer";
import { Button } from "@/components/ui/button";

/** 실패한 전달 한 건의 재시도. 결과는 로그에 새 줄로 쌓인다. */
export function RetryDeliveryForm({
  projectRef,
  prNumber,
}: {
  projectRef: string;
  prNumber: number;
}) {
  const retry = async (formData: FormData) => {
    announce(`Retrying PR #${prNumber}…`);
    await retryDelivery(formData);
    announce(`Retry for PR #${prNumber} finished. See the delivery log.`);
  };

  return (
    <form action={retry} className="shrink-0">
      <input type="hidden" name="projectRef" value={projectRef} />
      <input type="hidden" name="prNumber" value={prNumber} />
      <RetryButton prNumber={prNumber} />
    </form>
  );
}

function RetryButton({ prNumber }: { prNumber: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className="text-muted-foreground hover:text-foreground text-[12px] underline underline-offset-4 aria-disabled:opacity-50"
    >
      Retry
      {/* 같은 이름의 버튼이 줄마다 있어 어느 PR 인지 덧붙인다. */}
      <span className="sr-only"> PR #{prNumber}</span>
    </button>
  );
}

/**
 * 스누즈 해제. 해제되면 배너가 통째로 사라져 이 버튼의 포커스도 같이 사라진다 —
 * 끝나면 페이지 제목으로 포커스를 옮긴다.
 */
export function ResumeForm({ projectRef }: { projectRef: string }) {
  const resume = async (formData: FormData) => {
    await setSnooze(formData);
    announce("Notifications resumed.");
    document.querySelector<HTMLElement>("main h1")?.focus();
  };

  return (
    <form action={resume}>
      <input type="hidden" name="projectRef" value={projectRef} />
      <input type="hidden" name="duration" value="off" />
      <ResumeButton />
    </form>
  );
}

function ResumeButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="outline"
      disabled={pending}
      focusableWhenDisabled
      className="rounded-[4px]"
    >
      Resume
    </Button>
  );
}
