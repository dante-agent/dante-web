"use client";

// 헤더의 Feedback 버튼 → 서비스팀 문의 모달.
//
// 폼 부분만 따로 컴포넌트로 떼고 열릴 때마다 key 를 바꿔 다시 마운트한다.
// useActionState 의 결과(보냄/에러)는 모달을 닫아도 남아 있어서, 그대로 두면
// 다음에 열었을 때 지난번 "보냈어요" 화면이 그대로 보인다.

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { sendFeedback } from "@/lib/feedback";

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(sendFeedback, null);

  if (state?.sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Your message has been sent. We will reply to the email you signed up with.
        </p>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="page" value={pathname} />
      <textarea
        name="message"
        autoFocus
        rows={6}
        maxLength={5000}
        placeholder="Tell us what went wrong or what you need."
        aria-invalid={state?.error ? true : undefined}
        className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 aria-invalid:ring-3"
      />

      {state?.error && (
        <p role="alert" className="text-destructive text-[13px]">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Dialog.Close render={<Button type="button" variant="ghost" size="sm" />}>
          Cancel
        </Dialog.Close>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="ghost" size="sm" />}>Feedback</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-border bg-popover fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">Contact the team</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-[13px]">
              Report a bug or share feedback. The team reads every message.
            </Dialog.Description>
          </div>

          <FeedbackForm key={String(open)} onDone={() => setOpen(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
