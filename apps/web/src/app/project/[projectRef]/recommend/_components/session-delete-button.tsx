"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { deleteRecommendSession } from "../actions";

// 세션 내역 한 줄의 삭제 버튼. 누르면 확인 후 세션(버전)과 그 실행·대화를 지운다.
// 지금 보고 있는 세션을 지웠으면 목록으로 돌아가고, 아니면 현재 화면만 새로고침한다.
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
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function onDelete(event: React.MouseEvent) {
    // 부모가 Link 인 경우가 있어 이동/기본동작을 막는다.
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    if (!window.confirm(`Delete "${title}"? This also removes its runs and chat.`)) return;
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await deleteRecommendSession(projectRef, versionId);
        if (!result.ok) {
          setFailed(true);
          return;
        }
        // 지운 세션 상세를 보고 있었으면 목록으로, 아니면 제자리 새로고침.
        if (window.location.pathname.endsWith(`/recommend/${versionId}`)) {
          router.push(`/project/${projectRef}/recommend`);
        } else {
          router.refresh();
        }
      } catch (error) {
        unstable_rethrow(error);
        setFailed(true);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      aria-label={`Delete ${title}`}
      title={failed ? "Couldn't delete. Try again." : "Delete session"}
      className={cn(
        "shrink-0 rounded p-1 transition-colors disabled:opacity-50",
        failed ? "text-destructive" : "text-muted-foreground hover:text-destructive",
        className
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
