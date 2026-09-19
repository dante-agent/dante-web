"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  changeMemberRole,
  deleteTeam,
  leaveTeam,
  removeMember,
  renameTeam,
  type TeamFormState,
} from "@/app/team/[teamId]/settings/actions";
import { Button } from "@/components/ui/button";
import { useInlineConfirm } from "@/components/use-inline-confirm";
import { Input } from "@/components/ui/input";

// 팀 설정의 폼들. 규칙은 서버(lib/teams/manage.ts)가 정하고, 여기서는 누를 수 없는
// 버튼을 숨기기만 한다. 숨긴 버튼을 POST 로 직접 불러도 서버가 막는다.

export function RenameTeamForm({
  teamId,
  name,
  canEdit,
  maxLength,
}: {
  teamId: string;
  name: string;
  canEdit: boolean;
  maxLength: number;
}) {
  const [state, action, pending] = useActionState(renameTeam, null);

  return (
    <form action={action} className="border-border bg-card mt-8 max-w-2xl border p-5">
      <input type="hidden" name="teamId" value={teamId} />
      <label htmlFor="team-name" className="text-[15px] leading-snug font-medium">
        Team name
      </label>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        {canEdit ? "Everyone on the team sees this name." : "Only owners can rename the team."}
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          // 저장하면 서버가 새 이름으로 다시 그린다. 비제어 입력의 defaultValue 를 바꾸면
          // Base UI 가 경고하므로, 이름이 바뀌면 입력칸을 새로 만든다.
          key={name}
          id="team-name"
          name="name"
          defaultValue={name}
          maxLength={maxLength}
          disabled={!canEdit}
          readOnly={pending}
          className="rounded-[4px]"
        />
        {canEdit && (
          <Button
            type="submit"
            size="sm"
            disabled={pending}
            focusableWhenDisabled
            className="shrink-0 rounded-[4px]"
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      {/* min-h 고정: 문구가 생겼다 없어져도 카드 높이가 흔들리지 않는다. */}
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

/**
 * 멤버 한 줄의 버튼. 역할 바꾸기, 내보내기(남) 또는 나가기(나).
 *
 * 내보내기·나가기는 한 번 더 누르게 한다. 모달까지 띄울 일은 아니지만(되돌리려면
 * 다시 초대하면 된다), 줄마다 붙은 버튼이라 손이 미끄러지기 쉽다.
 */
export function MemberControls({
  teamId,
  userId,
  role,
  isSelf,
  canManage,
  canChangeRole,
  canLeave,
}: {
  teamId: string;
  userId: string;
  role: "owner" | "member";
  isSelf: boolean;
  /** 이 줄을 내보낼 수 있는가. 보는 사람이 owner 이고 대상이 개인 팀 주인이 아닐 때. */
  canManage: boolean;
  /**
   * 이 줄의 역할을 바꿀 수 있는가. canManage 에 더해, 마지막 owner 를 member 로 내리는
   * 경우는 뺀다. 눌러 봐야 서버가 "owner 는 한 명 이상" 으로 막는 버튼이라 아예 그리지 않는다.
   */
  canChangeRole: boolean;
  /** 이 줄이 나 자신이고 나갈 수 있는가. */
  canLeave: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRole, null);
  const [removeState, removeAction, removePending] = useActionState(
    isSelf ? leaveTeam : removeMember,
    null
  );
  const { confirming, start, cancel, triggerRef, confirmRef } = useInlineConfirm();

  const pending = rolePending || removePending;
  const failure = [removeState, roleState].find((state): state is NonNullable<TeamFormState> =>
    Boolean(state && !state.ok)
  );
  const nextRole = role === "owner" ? "member" : "owner";
  const canRemove = isSelf ? canLeave : canManage;

  if (!canChangeRole && !canRemove) return null;

  // 실패 문구는 버튼 줄 아래에 띄워 둔다(absolute). 흐름 안에 두면 문구가 생길 때 줄
  // 높이가 늘고, 가운데 정렬된 버튼이 위로 밀려 올라간다.
  return (
    <div className="relative flex shrink-0 items-center gap-1">
      <div className="flex items-center gap-1">
        {canChangeRole && (
          <form action={roleAction}>
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="role" value={nextRole} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={pending}
              focusableWhenDisabled
              className="rounded-[4px]"
            >
              {nextRole === "owner" ? "Make owner" : "Make member"}
            </Button>
          </form>
        )}

        {canRemove && (
          <form action={removeAction} className="flex items-center gap-1">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="userId" value={userId} />
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
                  {isSelf ? "Leave team" : "Remove"}
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
                {isSelf ? "Leave" : "Remove"}
              </Button>
            )}
          </form>
        )}
      </div>

      {failure && !pending && (
        <p
          role="status"
          aria-live="polite"
          className="text-destructive absolute top-full right-0 mt-0.5 text-[12px] whitespace-nowrap"
        >
          {failure.message}
        </p>
      )}
    </div>
  );
}

// 팀 삭제 확인. 프로젝트 삭제(delete-project-form.tsx)와 같은 모양이다 — 팀 이름을
// 그대로 쳐야 버튼이 풀리고, 열 때마다 key 를 바꿔 지난 입력과 실패 문구를 비운다.
function DeleteTeamDialogForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [state, formAction, pending] = useActionState(deleteTeam, null);
  const [typed, setTyped] = useState("");
  const matches = typed === teamName;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="teamId" value={teamId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="delete-team-confirmation" className="text-muted-foreground text-[13px]">
          Type <span className="text-foreground font-mono">{teamName}</span> to confirm.
        </label>
        <Input
          id="delete-team-confirmation"
          name="confirmation"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="rounded-[4px] font-mono"
        />
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className="text-destructive min-w-0 truncate text-[13px]"
        >
          {pending ? "" : (state?.message ?? "")}
        </p>

        <div className="flex shrink-0 gap-2">
          <Dialog.Close
            disabled={pending}
            render={<Button type="button" variant="ghost" size="sm" className="rounded-[4px]" />}
          >
            Cancel
          </Dialog.Close>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={!matches || pending}
            focusableWhenDisabled
            className="rounded-[4px]"
          >
            {pending ? "Deleting…" : "Delete this team"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function DeleteTeamForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={<Button variant="destructive" size="sm" className="mt-5 rounded-[4px]" />}
      >
        Delete this team
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-destructive/35 bg-popover fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">Delete this team</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-[13px] leading-relaxed">
              This permanently removes <span className="text-foreground font-mono">{teamName}</span>
              , its members, GitHub connections and every project in it. This cannot be undone.
            </Dialog.Description>
          </div>

          <DeleteTeamDialogForm key={String(open)} teamId={teamId} teamName={teamName} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
