"use client";

import { useActionState, useState } from "react";
import { deleteProject } from "@/app/project/[projectRef]/settings/general/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 프로젝트 삭제 확인. General 페이지 맨 아래 Danger zone 에 산다.
//
// 모달이 아니라 페이지 안에서 받는다 — 다이얼로그 컴포넌트가 없고, 확인에 필요한
// 건 입력 한 칸뿐이다. 대신 GitHub 레포 삭제처럼 owner/name 을 그대로 쳐야 버튼이
// 풀린다. "정말요?" 한 번 누르기는 손이 먼저 나가서 실수를 못 막는다.
//
// 결과(실패 문구)는 recheck-button.tsx 처럼 버튼 옆 한 줄로 붙인다. 성공하면
// 서버가 목록으로 보내서 이 폼은 사라진다.
export function DeleteProjectForm({
  projectRef,
  repoFullName,
}: {
  projectRef: string;
  /** "owner/name". 사용자가 그대로 쳐야 하는 값. */
  repoFullName: string;
}) {
  const [state, formAction, pending] = useActionState(deleteProject, null);
  const [typed, setTyped] = useState("");

  // 앞뒤 공백도 틀린 것으로 본다. 서버도 같은 기준으로 다시 비교한다(actions.ts).
  const matches = typed === repoFullName;

  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="projectRef" value={projectRef} />

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
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="mt-2 max-w-sm rounded-[4px] font-mono"
      />

      {/* h-8 고정: 실패 문구가 생겼다 없어져도 박스 높이가 흔들리지 않는다. */}
      <div className="mt-4 flex h-8 items-center gap-3">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={!matches || pending}
          className="shrink-0 rounded-[4px]"
        >
          {pending ? "Deleting…" : "Delete this project"}
        </Button>

        <p
          role="status"
          aria-live="polite"
          className="text-destructive min-w-0 truncate text-[13px]"
        >
          {pending ? "" : (state?.message ?? "")}
        </p>
      </div>
    </form>
  );
}
