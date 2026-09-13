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
      <label htmlFor="new-team-name" className="text-[15px] leading-snug font-medium">
        Create a team
      </label>
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
          disabled={pending}
          className="rounded-[4px]"
        />
        <Button type="submit" size="sm" disabled={pending} className="shrink-0 rounded-[4px]">
          {pending ? "Creating…" : "Create team"}
        </Button>
      </div>

      <p role="status" aria-live="polite" className="text-destructive mt-2 min-h-5 text-[13px]">
        {pending ? "" : (state?.message ?? "")}
      </p>
    </form>
  );
}
