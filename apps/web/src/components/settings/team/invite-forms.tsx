"use client";

import { useActionState, useState } from "react";
import { inviteMember, revokeInvite } from "@/app/team/[teamId]/settings/actions";
import { copyAndAnnounce } from "@/components/live-announcer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 멤버 화면의 초대 폼. owner 에게만 그린다. 규칙은 서버(lib/teams/invites.ts)가 정한다.

export function InviteForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(inviteMember, null);

  // React 19 는 액션이 끝나면 비제어 입력을 비운다. 보낸 뒤 같은 주소가 남아 있지 않다.
  return (
    <form action={action} className="border-border bg-card mt-8 max-w-2xl border p-5">
      <input type="hidden" name="teamId" value={teamId} />
      {/* 폼 제목을 헤딩으로도 둔다 — 제목 목록으로 이동할 때 이 폼이 빠지지 않게. 모양은 그대로. */}
      <h2 className="text-[15px] leading-snug font-medium">
        <label htmlFor="invite-email">Invite by email</label>
      </h2>
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
          readOnly={pending}
          aria-invalid={state?.ok === false || undefined}
          aria-describedby="invite-status"
          className="rounded-[4px]"
        />
        <Button
          type="submit"
          disabled={pending}
          focusableWhenDisabled
          className="shrink-0 rounded-[4px]"
        >
          <SteadyLabel labels={["Send invite", "Sending…"]} active={pending ? 1 : 0} />
        </Button>
      </div>

      <p
        id="invite-status"
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
        variant="secondary"
        className="shrink-0 rounded-[4px]"
        onClick={async () => {
          if (await copyAndAnnounce(link)) setCopied(true);
        }}
      >
        <SteadyLabel labels={["Copy link", "Copied"]} active={copied ? 1 : 0} />
      </Button>
    </div>
  );
}

// 문구를 한 칸에 겹쳐 두고 하나만 보인다. 폭이 가장 긴 문구에 맞춰져서, 문구가 바뀌어도
// 버튼과 옆 입력창의 폭이 그대로다.
function SteadyLabel({ labels, active }: { labels: string[]; active: number }) {
  return (
    <span className="grid">
      {labels.map((label, index) => (
        <span
          key={label}
          className={`col-start-1 row-start-1 ${index === active ? "" : "invisible"}`}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

export function RevokeInviteButton({
  teamId,
  inviteId,
  email,
}: {
  teamId: string;
  inviteId: string;
  /** 줄마다 같은 버튼이 있어 스크린리더용으로 어느 초대인지 덧붙인다. */
  email: string;
}) {
  const [state, action, pending] = useActionState(revokeInvite, null);

  return (
    // 실패 문구는 버튼 아래에 띄운다(MemberControls 와 같은 이유 — 버튼이 위로 밀리지 않게).
    <form action={action} className="relative shrink-0">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        focusableWhenDisabled
        className="rounded-[4px]"
      >
        {pending ? "Revoking…" : "Revoke"}
        <span className="sr-only"> invite for {email}</span>
      </Button>
      {/* live 영역은 늘 그려 둔다 — 문구와 함께 끼워 넣으면 스크린리더가 놓친다.
          넘치지 않게 폭을 제한하고 줄바꿈을 허용한다. */}
      <p
        role="status"
        className="text-destructive absolute top-full right-0 mt-0.5 w-max max-w-64 text-right text-[12px]"
      >
        {state && !state.ok ? state.message : ""}
      </p>
    </form>
  );
}
