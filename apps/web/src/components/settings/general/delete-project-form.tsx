"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { deleteProject } from "@/app/project/[projectRef]/settings/general/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 프로젝트 삭제 확인. General 페이지 맨 아래 Danger zone 에 산다.
//
// 페이지에는 버튼 하나만 두고, 확인 입력은 모달에서 받는다. GitHub 레포 삭제처럼
// owner/name 을 그대로 쳐야 버튼이 풀린다. "정말요?" 한 번 누르기는 손이 먼저
// 나가서 실수를 못 막는다.
//
// 폼 부분은 feedback-dialog.tsx 처럼 열릴 때마다 key 를 바꿔 다시 마운트한다.
// 입력값과 useActionState 의 실패 문구가 닫아도 남아 있어서, 그대로 두면 다음에
// 열었을 때 지난번 것이 그대로 보인다. 성공하면 서버가 목록으로 보내서 모달째
// 사라진다.
function DeleteProjectDialogForm({
  projectRef,
  repoFullName,
}: {
  projectRef: string;
  repoFullName: string;
}) {
  const [state, formAction, pending] = useActionState(deleteProject, null);
  const [typed, setTyped] = useState("");

  // 앞뒤 공백도 틀린 것으로 본다. 서버도 같은 기준으로 다시 비교한다(actions.ts).
  const matches = typed === repoFullName;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="projectRef" value={projectRef} />

      <div className="flex flex-col gap-2">
        <label htmlFor="delete-confirmation" className="text-muted-foreground text-[13px]">
          Type <span className="text-foreground font-mono">{repoFullName}</span> to confirm.
        </label>
        {/* 자동완성·맞춤법 교정을 끈다. 브라우저가 채워주거나 고쳐주면 "직접
            쳐서 확인한다"는 의미가 없어진다. */}
        <Input
          id="delete-confirmation"
          name="confirmation"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // 실패 문구(아래 status)를 이 칸의 설명으로 잇는다.
          aria-invalid={Boolean(!pending && state?.message) || undefined}
          aria-describedby="delete-project-status"
          className="rounded-[4px] font-mono"
        />
      </div>

      {/* min-h 고정: 실패 문구가 생겼다 없어져도 모달 높이가 흔들리지 않는다. */}
      <div className="flex min-h-8 items-center justify-between gap-3">
        {/* 오류 문구는 자르지 않고 줄바꿈한다 — 끝이 잘리면 무엇이 틀렸는지 알 수 없다. */}
        <p
          id="delete-project-status"
          role="status"
          aria-live="polite"
          className="text-destructive min-w-0 text-[13px] wrap-break-word"
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
            {pending ? "Deleting…" : "Delete this project"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function DeleteProjectForm({
  projectRef,
  repoFullName,
}: {
  projectRef: string;
  /** "owner/name". 사용자가 그대로 쳐야 하는 값. */
  repoFullName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={<Button variant="destructive" size="sm" className="mt-5 rounded-[4px]" />}
      >
        Delete this project
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-destructive/35 bg-popover fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">Delete this project</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-[13px] leading-relaxed">
              This permanently removes{" "}
              <span className="text-foreground font-mono">{repoFullName}</span> and everything Dante
              stored for it. This cannot be undone.
            </Dialog.Description>
          </div>

          <DeleteProjectDialogForm
            key={String(open)}
            projectRef={projectRef}
            repoFullName={repoFullName}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
