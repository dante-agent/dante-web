"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { deleteApiKey } from "@/app/account/settings/actions";
import { Button } from "@/components/ui/button";
import type { AiProvider } from "@/lib/projects/ai-providers";

// API 키 삭제 확인. 계정 설정의 프로바이더 행에서 "Remove key" 를 누르면 뜬다.
//
// 키는 계정 단위라 지우면 이 키를 쓰던 프로젝트가 전부 같이 끊긴다. 페이지의
// 링크 하나로 바로 지워지면 그 사실을 알 길이 없어서, 모달로 먼저 알린다.
//
// 타이핑 확인은 받지 않는다. 프로젝트 삭제와 달리 키는 다시 붙여넣으면 그대로
// 복구되고, 벤더 콘솔의 키 자체는 건드리지 않는다. 한 번 더 누르는 것으로 충분.
//
// 폼 부분은 delete-project-form.tsx 처럼 열릴 때마다 key 를 바꿔 다시 마운트한다.
// useActionState 의 pending 이 닫아도 남아 있으면 다음에 열었을 때 버튼이 잠긴
// 채로 보일 수 있다.
function RemoveApiKeyDialogForm({
  provider,
  onDone,
}: {
  provider: AiProvider;
  onDone: () => void;
}) {
  // deleteApiKey 는 돌려주는 게 없다. 시그니처를 건드리지 않고 여기서 감싸,
  // 끝나면 모달을 닫는다. 서버가 revalidatePath 로 다시 그리면 lastFour 가
  // 사라지고 행이 NOT SET 으로 바뀐다. 삭제 자체는 deleteMany 라 두 번 눌러도
  // 터지지 않고, pending 동안은 버튼도 잠근다.
  const [, formAction, pending] = useActionState(async (_previous: null, formData: FormData) => {
    await deleteApiKey(formData);
    onDone();
    return null;
  }, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="provider" value={provider.id} />

      {/* min-h 고정: delete-project-form 과 같은 높이의 버튼 줄. */}
      <div className="flex min-h-8 items-center justify-end gap-2">
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
          disabled={pending}
          className="rounded-[4px]"
        >
          {pending ? "Removing…" : "Remove key"}
        </Button>
      </div>
    </form>
  );
}

export function RemoveApiKeyDialog({
  provider,
  lastFour,
}: {
  provider: AiProvider;
  /** 저장된 키의 끝 4자리. 어느 키를 지우는지 보여주는 용도. */
  lastFour: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* 페이지 쪽 모양은 이전의 submit 버튼 그대로: 밑줄 텍스트, hover 시 destructive. */}
      <Dialog.Trigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive text-[13px] underline underline-offset-4 transition-colors duration-[180ms] ease-out"
          />
        }
      >
        Remove key
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-destructive/35 bg-popover fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">
              Remove {provider.vendor} key
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-[13px] leading-relaxed">
              This removes the key ending in{" "}
              <span className="text-foreground font-mono">····{lastFour}</span>. Every project
              you&apos;ve connected loses access to {provider.vendor} until you add a key again.
              Tests that use it will stop generating.
            </Dialog.Description>
          </div>

          <RemoveApiKeyDialogForm
            key={String(open)}
            provider={provider}
            onDone={() => setOpen(false)}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
