"use client";

import { useActionState } from "react";
import { disconnectSlack } from "@/app/team/[teamId]/settings/actions";
import { Button } from "@/components/ui/button";
import { useInlineConfirm } from "@/components/use-inline-confirm";

/** 연결 끊기. 프로젝트 알림이 바로 멈추므로 한 번 더 누르게 한다(team-forms.tsx 의 내보내기와 같다). */
export function DisconnectSlackForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(disconnectSlack, null);
  const { confirming, start, cancel, triggerRef, confirmRef } = useInlineConfirm();

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      {confirming ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            focusableWhenDisabled
            onClick={cancel}
            className="rounded-[4px]"
          >
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="submit"
            variant="destructive"
            size="sm"
            disabled={pending}
            focusableWhenDisabled
            className="rounded-[4px]"
          >
            {pending ? "Disconnecting…" : "Disconnect"}
          </Button>
        </>
      ) : (
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="sm"
          onClick={start}
          className="text-destructive rounded-[4px]"
        >
          Disconnect
        </Button>
      )}
      {state && !state.ok && (
        <p role="status" className="text-destructive text-[13px]">
          {state.message}
        </p>
      )}
    </form>
  );
}
