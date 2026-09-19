"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Re-run 폼의 제출 버튼. 보내는 동안 막는다 — 연달아 누르면 같은 커밋 작업이 여러 번 들어간다
 * (서버도 lib/notifications/pull-request-job.ts 의 claimJob 에서 한 번 더 막는다).
 */
export function RerunButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled}
      // 보내는 중에는 disabled 대신 aria-disabled — 누른 버튼이 포커스를 잃지 않게. 제출은 여기서 막는다.
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className="bg-primary text-primary-foreground hover:bg-primary-hover flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      Re-run
    </button>
  );
}
