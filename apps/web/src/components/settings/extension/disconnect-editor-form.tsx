"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { revokeExtensionConnection } from "@/app/account/settings/actions";
import { Button } from "@/components/ui/button";

// 에디터 연결 해제. 연결된 에디터 목록의 행마다 하나씩 산다.
//
// 프로젝트 삭제(delete-project-form.tsx)처럼 이름을 치게 하지는 않는다 — 잃는 건
// 그 에디터의 로그인 상태뿐이라 다시 로그인하면 돌아온다. 대신 "정말요?" 한 번은
// 받는다. 줄마다 버튼이 붙어 있어서 한 번에 지워지면 어느 줄을 눌렀는지도 모른다.
//
// 성공하면 서버가 목록을 다시 그려 이 행이 사라지므로 성공 문구는 따로 없다.
export function DisconnectEditorForm({ id, editor }: { id: string; editor: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:text-destructive text-[13px] underline underline-offset-4 transition-colors duration-[180ms] ease-out"
      >
        Disconnect
      </button>
    );
  }

  return (
    <form action={revokeExtensionConnection}>
      <input type="hidden" name="id" value={id} />

      <p className="text-muted-foreground text-[13px] leading-relaxed">
        This signs {editor} out of Dante. To keep using the extension there, you will have to sign
        in again from the editor.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <ConfirmButton editor={editor} />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          className="rounded-[4px]"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// 제출 중 표시는 form 안에서만 읽힌다(useFormStatus). 그래서 버튼을 따로 뗐다.
function ConfirmButton({ editor }: { editor: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      disabled={pending}
      className="rounded-[4px]"
    >
      {pending ? "Disconnecting…" : `Disconnect ${editor}`}
    </Button>
  );
}
