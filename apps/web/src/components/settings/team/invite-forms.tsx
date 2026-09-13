"use client";

import { useActionState, useState } from "react";
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
        className={`mt-2 min-h-5 text-[13px] ${state?.ok && !state.link ? "text-muted-foreground" : "text-destructive"}`}
      >
        {pending ? "" : (state?.message ?? "")}
      </p>

      {/* 메일이 실패했을 때만 온다. 한 번만 보이는 값이라(DB 에는 해시만 있다) 바로 복사하게 한다. */}
      {!pending && state?.link && <InviteLink link={state.link} />}
    </form>
  );
}

function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2 flex gap-2">
      <Input
        readOnly
        value={link}
        aria-label="Invite link"
        onFocus={(event) => event.currentTarget.select()}
        className="rounded-[4px] font-mono text-[12px]"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0 rounded-[4px]"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

export function RevokeInviteButton({ teamId, inviteId }: { teamId: string; inviteId: string }) {
  const [state, action, pending] = useActionState(revokeInvite, null);

  return (
    // 실패 문구는 버튼 아래에 띄운다(MemberControls 와 같은 이유 — 버튼이 위로 밀리지 않게).
    <form action={action} className="relative shrink-0">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="rounded-[4px]">
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      {state && !state.ok && (
        <p
          role="status"
          className="text-destructive absolute top-full right-0 mt-0.5 text-[12px] whitespace-nowrap"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
