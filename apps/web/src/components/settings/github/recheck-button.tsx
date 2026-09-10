"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { recheckConnection } from "@/app/project/[projectRef]/settings/github/actions";
import { Button } from "@/components/ui/button";

// "지금 다시 확인해줘" 버튼. 무엇을 왜 확인하는지는 actions.ts 주석에 있다.
//
// 결과는 버튼 왼쪽에 한 줄로 붙인다. 토스트가 아닌 이유는 두 가지다 — 앱에
// 토스트 기반이 아직 없고(새 의존성은 사람 승인이 필요하다: AGENTS.md), 이
// 결과는 바로 위 배너가 사라지느냐 남느냐와 짝이라 그 옆에 있는 편이 읽기 쉽다.
//
// 폼으로 보내는 이유: 서버 액션을 form action 으로 걸면 React 가 CSRF 보호와
// 전송 중 상태(pending)를 같이 준다. onClick 으로 부르면 둘 다 직접 해야 한다.
export function RecheckButton({ projectRef }: { projectRef: string }) {
  const [state, formAction, pending] = useActionState(recheckConnection, null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="projectRef" value={projectRef} />

      {/* aria-live: 버튼을 눌러 생긴 결과라 스크린리더가 이어서 읽어야 한다.
          polite 는 읽던 것을 끊지 않고 끝난 뒤에 읽는다는 뜻이다. */}
      <p
        role="status"
        aria-live="polite"
        className={`text-[13px] ${state?.ok ? "text-brand-mint" : "text-muted-foreground"}`}
      >
        {pending ? "Checking…" : (state?.message ?? "")}
      </p>

      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        className="rounded-[4px]"
      >
        <RefreshCw
          data-icon="inline-start"
          className={pending ? "animate-spin motion-reduce:animate-none" : undefined}
        />
        Recheck
      </Button>
    </form>
  );
}
