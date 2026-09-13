"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";

// 초대 수락 화면의 본문. 받은 주소와 로그인한 계정이 다르면 그 사실을 보여준다 —
// 막지는 않지만(결정 3), 엉뚱한 계정으로 들어가는 실수는 여기서 알아챈다.
export function AcceptInvite({
  token,
  teamName,
  inviterName,
  invitedEmail,
  account,
  accountEmail,
}: {
  token: string;
  teamName: string;
  inviterName: string | null;
  invitedEmail: string;
  account: string;
  accountEmail: string | null;
}) {
  const [state, action, pending] = useActionState(acceptInvite, null);
  const otherAccount = accountEmail !== invitedEmail;

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Join {teamName}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {inviterName ? `${inviterName} invited you` : "You were invited"} to work on this
        team&apos;s projects as a member.
      </p>

      <dl className="border-border divide-border bg-card mt-6 divide-y border text-[13px]">
        <div className="flex gap-3 px-4 py-3">
          <dt className="text-muted-foreground w-24 shrink-0">Sent to</dt>
          <dd className="min-w-0 flex-1 truncate font-mono">{invitedEmail}</dd>
        </div>
        <div className="flex gap-3 px-4 py-3">
          <dt className="text-muted-foreground w-24 shrink-0">Joining as</dt>
          <dd className="min-w-0 flex-1 truncate font-mono">{account}</dd>
        </div>
      </dl>

      {otherAccount && (
        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          You&apos;re signed in with a different account than the one invited. Accepting adds{" "}
          <span className="text-foreground">{account}</span> to the team.
        </p>
      )}

      <form action={action} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" size="lg" disabled={pending} className="h-10 w-full">
          {pending ? "Joining…" : `Join ${teamName}`}
        </Button>
        <p role="status" aria-live="polite" className="text-destructive mt-3 min-h-5 text-[13px]">
          {pending ? "" : (state?.message ?? "")}
        </p>
      </form>
    </>
  );
}
