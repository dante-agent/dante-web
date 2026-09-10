"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import {
  saveNotificationScope,
  type SaveState,
} from "@/app/project/[projectRef]/settings/notifications/actions";
import { Section, ToggleRow } from "@/components/settings/notifications/controls";
import { Button } from "@/components/ui/button";
import { SKIP_LABEL } from "@/lib/notifications/scope";

// 적용 범위 (§6.1). GitHub 섹션과 폼을 나눈 이유는 고치는 이유가 다르기 때문이다 —
// 브랜치 필터는 한 번 정하면 거의 안 건드리고, 표시 항목은 자주 만진다.

export function NotificationScopeForm({
  projectRef,
  defaultBranch,
  initial,
}: {
  projectRef: string;
  defaultBranch: string;
  initial: { branchFilters: string[]; skipDraftPr: boolean };
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    saveNotificationScope,
    null
  );
  const [skipDraftPr, setSkipDraftPr] = useState(initial.skipDraftPr);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectRef" value={projectRef} />

      <Section title="Where it applies" description="Which pull requests Dante writes to at all.">
        <label className="border-border block border-b p-4">
          <span className="block text-[13px] leading-tight">Base branches</span>
          <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">
            One pattern per line — <code className="font-mono">release/*</code> is allowed. Leave it
            empty to only watch pull requests into{" "}
            <code className="font-mono">{defaultBranch}</code>.
          </span>
          <textarea
            name="branchFilters"
            defaultValue={initial.branchFilters.join("\n")}
            rows={3}
            spellCheck={false}
            placeholder={defaultBranch}
            className="border-border bg-background mt-3 w-full border p-2 font-mono text-[12px]"
          />
        </label>

        <ToggleRow
          name="skipDraftPr"
          label="Skip draft pull requests"
          hint={`A pull request labelled ${SKIP_LABEL}, or a commit message containing [skip dante], is always skipped.`}
          checked={skipDraftPr}
          onChange={setSkipDraftPr}
        />
      </Section>

      <div className="mt-4 flex max-w-2xl items-center gap-3">
        <Button type="submit" size="sm" disabled={pending} className="rounded-[4px]">
          {pending ? "Saving..." : "Save"}
        </Button>
        {state?.saved && (
          <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
            <Check className="size-3.5" />
            Saved
          </span>
        )}
        {state?.error && (
          <span role="alert" className="text-destructive text-[13px]">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
