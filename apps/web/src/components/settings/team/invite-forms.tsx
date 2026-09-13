"use client";

import { useActionState } from "react";
import { inviteMember, revokeInvite } from "@/app/team/[teamId]/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 멤버 화면의 초대 폼. owner 에게만 그린다. 규칙은 서버(lib/teams/invites.ts)가 정한다.

export function InviteForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(inviteMember, null);

  // React 19 는 액션이 끝나면 비제어 입력을 비운다. 보낸 뒤 같은 주소가 남아 있지 않다.
  return (
    <form action={action} className="border-border bg-card mt-8 max-w-2xl border p-5">
      <input type="hidden" name="teamId" value={teamId} />
      <label htmlFor="invite-email" className="text-[15px] leading-snug font-medium">
        Invite by email
      </label>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        They join as a member. The link works once and expires in 7 days, and they can accept with
        any account they sign in with.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="name@company.com"
          autoComplete="off"
          disabled={pending}
          className="rounded-[4px]"
        />
        <Button type="submit" size="sm" disabled={pending} className="shrink-0 rounded-[4px]">
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-5 text-[13px] ${state?.ok ? "text-muted-foreground" : "text-destructive"}`}
      >
        {pending ? "" : (state?.message ?? "")}
      </p>
    </form>
  );
}

export function RevokeInviteButton({ teamId, inviteId }: { teamId: string; inviteId: string }) {
  const [state, action, pending] = useActionState(revokeInvite, null);

  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="rounded-[4px]">
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      {state && !state.ok && (
        <p role="status" className="text-destructive text-[12px]">
          {state.message}
        </p>
      )}
    </form>
  );
}
