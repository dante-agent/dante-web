"use client";

import { Check } from "lucide-react";
import { useAnnounce } from "@/components/live-announcer";

// controls.tsx 에서 뗐다 — 그쪽은 서버 페이지도 가져다 쓰는데, 이건 결과를 알리는 훅을 쓴다.

/**
 * 저장·테스트 버튼 옆의 상태 자리 하나. 마지막으로 누른 버튼의 결과만 보인다
 * (discord-form.tsx·slack-notifications-form.tsx).
 */
export function FormStatus({
  pending,
  pendingLabel,
  done,
  doneLabel,
  error,
}: {
  pending: boolean;
  pendingLabel: string;
  done?: boolean;
  doneLabel: string;
  error?: string;
}) {
  // 화면 문구는 조건부로 바뀌어서 스크린리더가 놓친다. 결과는 공용 알림으로 읽는다.
  // 제출마다 pending 이 켜졌다 꺼지므로 "Saved" 가 연달아 와도 다시 읽힌다.
  useAnnounce(pending ? null : done && !error ? doneLabel : null, pending);
  if (pending) return <span className="text-muted-foreground text-[13px]">{pendingLabel}</span>;
  if (error) {
    return (
      <span role="alert" className="text-destructive text-[13px]">
        {error}
      </span>
    );
  }
  if (!done) return null;
  return (
    <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
      <Check className="size-3.5" />
      {doneLabel}
    </span>
  );
}
