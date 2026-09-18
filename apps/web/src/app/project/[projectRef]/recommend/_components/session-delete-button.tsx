"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteRecommendSession } from "../actions";

// 세션 내역 한 줄의 삭제 버튼. 누르면 인앱 확인 다이얼로그를 띄우고, 확인하면 세션(버전)과
// 그 실행·대화를 지운다. 지금 보고 있는 세션을 지웠으면 목록으로 돌아가고, 아니면 제자리 새로고침.
export function SessionDeleteButton({
  projectRef,
  versionId,
  title,
  className,
}: {
  projectRef: string;
  versionId: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteRecommendSession(projectRef, versionId);
        if (!result.ok) {
          setError("Couldn't delete this session. Try again.");
          return;
        }
        setOpen(false);
        // 지운 세션 상세를 보고 있었으면 목록으로, 아니면 제자리 새로고침.
        if (window.location.pathname.endsWith(`/recommend/${versionId}`)) {
          router.push(`/project/${projectRef}/recommend`);
        } else {
          router.refresh();
        }
      } catch (err) {
        unstable_rethrow(err);
        setError("Couldn't delete this session. Try again.");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label={`Delete ${title}`}
            title="Delete session"
            onClick={(event) => event.preventDefault()}
            className={cn(
              "text-muted-foreground hover:text-destructive shrink-0 rounded p-1 transition-colors",
              className
            )}
          >
            <Trash2 className="size-4" />
          </button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="border-border bg-popover fixed top-1/2 left-1/2 z-50 flex w-[24rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-base font-medium">Delete session?</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-xs">
              <span className="font-medium">{title}</span> and its runs and chat will be permanently
              removed. This can’t be undone.
            </Dialog.Description>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close
              render={<Button type="button" variant="ghost" size="sm" disabled={pending} />}
            >
              Cancel
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={confirmDelete}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : null}
              {pending ? "Deleting" : "Delete"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
