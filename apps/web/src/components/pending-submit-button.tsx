"use client";

// 서버 액션 폼의 제출 버튼. 보내는 동안 막되 disabled 대신 aria-disabled 로 막는다 —
// disabled 가 되면 방금 누른 버튼이 포커스를 잃는다(Base UI focusableWhenDisabled 가
// 클릭·Enter 제출을 막아 준다). 보내는 중이라는 것은 공용 알림으로 한 번 읽는다.

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useAnnounce } from "@/components/live-announcer";
import { Button } from "@/components/ui/button";

export function PendingSubmitButton({
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type" | "disabled"> & {
  /** 보내는 동안 스크린리더에 읽을 문구. 예: "Saving…" */
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  useAnnounce(pending ? pendingLabel : null);
  return (
    <Button
      type="submit"
      disabled={pending}
      focusableWhenDisabled
      aria-busy={pending || undefined}
      {...props}
    />
  );
}
