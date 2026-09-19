"use client";

import { useActionState } from "react";
import { createTeam } from "@/app/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 계정 설정 Teams 의 새 팀 폼. 이름 규칙은 서버(manage.ts)가 정한다.
export function CreateTeamForm({ maxLength }: { maxLength: number }) {
  const [state, action, pending] = useActionState(createTeam, null);

  return (
    <form action={action} className="border-border bg-card mt-8 max-w-2xl border p-5">
      {/* 폼 제목을 헤딩으로도 둔다 — 제목 목록으로 이동할 때 이 폼이 빠지지 않게. 모양은 그대로. */}
      <h2 className="text-[15px] leading-snug font-medium">
        <label htmlFor="new-team-name">Create a team</label>
      </h2>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        You become its owner. Invite people next, then connect GitHub while this team is selected.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          id="new-team-name"
          name="name"
          required
          maxLength={maxLength}
          placeholder="Acme frontend"
          autoComplete="off"
          readOnly={pending}
          // 실패 문구(아래 status)를 이 칸의 설명으로 잇는다.
          aria-invalid={Boolean(!pending && state?.message) || undefined}
          aria-describedby="new-team-status"
          className="rounded-[4px]"
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          focusableWhenDisabled
          className="shrink-0 rounded-[4px]"
        >
          {pending ? "Creating…" : "Create team"}
        </Button>
      </div>

      <p
        id="new-team-status"
        role="status"
        aria-live="polite"
        className="text-destructive mt-2 min-h-5 text-[13px]"
      >
        {pending ? "" : (state?.message ?? "")}
      </p>
    </form>
  );
}
