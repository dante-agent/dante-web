"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { deleteAccount } from "@/app/account/settings/general/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 계정 삭제 확인. 모양은 프로젝트 삭제(delete-project-form.tsx)와 같다 — 이메일(없으면
// 핸들)을 그대로 쳐야 버튼이 풀리고, 열 때마다 key 를 바꿔 지난 입력과 실패 문구를 비운다.
function DeleteAccountDialogForm({ confirmation }: { confirmation: string }) {
  const [state, formAction, pending] = useActionState(deleteAccount, null);
  const [typed, setTyped] = useState("");
  const matches = typed === confirmation;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="delete-account-confirmation" className="text-muted-foreground text-[13px]">
          Type <span className="text-foreground font-mono">{confirmation}</span> to confirm.
        </label>
        <Input
          id="delete-account-confirmation"
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
        <p role="status" aria-live="polite" className="text-destructive min-w-0 text-[13px]">
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
            className="rounded-[4px]"
          >
            {pending ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ confirmation }: { confirmation: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={<Button variant="destructive" size="sm" className="mt-5 rounded-[4px]" />}
      >
        Delete my account
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-destructive/35 bg-popover fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">Delete your account</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-[13px] leading-relaxed">
              This permanently removes your personal team and every project in it, your AI usage and
              chat history, and your editor sign-ins. You leave every other team. This cannot be
              undone.
            </Dialog.Description>
          </div>

          <DeleteAccountDialogForm key={String(open)} confirmation={confirmation} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
