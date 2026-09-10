"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { recheckConnection } from "@/app/project/[projectRef]/settings/github/actions";
import { Button } from "@/components/ui/button";

// "지금 다시 확인해줘" 버튼. 무엇을 왜 확인하는지는 actions.ts 주석에 있다.
// 배너 안에만 산다 (connection-banner.tsx).
//
// 결과는 버튼 옆에 한 줄로 붙인다. 토스트가 아닌 이유는 앱에 토스트 기반이 없고
// 새 의존성은 사람 승인이 필요해서다(AGENTS.md). 성공하면 배너가 통째로 접히므로
// 이 문구가 주로 하는 일은 "눌렀는데 아직 그대로다"를 말하는 쪽이다.
//
// 폼으로 보내는 이유: 서버 액션을 form action 으로 걸면 React 가 CSRF 보호와
// 전송 중 상태(pending)를 같이 준다. onClick 으로 부르면 둘 다 직접 해야 한다.
export function RecheckButton({ projectRef }: { projectRef: string }) {
  const [state, formAction, pending] = useActionState(recheckConnection, null);

  return (
    <form action={formAction} className="flex min-w-0 flex-1 items-center gap-3">
      <input type="hidden" name="projectRef" value={projectRef} />

      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="shrink-0 rounded-[4px]"
      >
        <RefreshCw
          data-icon="inline-start"
          className={pending ? "animate-spin motion-reduce:animate-none" : undefined}
        />
        Recheck
      </Button>

      {/* aria-live: 버튼을 눌러 생긴 결과라 스크린리더가 이어서 읽어야 한다.
          polite 는 읽던 것을 끊지 않고 끝난 뒤에 읽는다는 뜻이다.
          truncate: 문구가 길어도 줄바꿈으로 배너를 키우지 않는다. */}
      <p
        role="status"
        aria-live="polite"
        className={`min-w-0 truncate text-[13px] ${state?.ok ? "text-brand-mint" : "text-muted-foreground"}`}
      >
        {pending ? "Checking…" : (state?.message ?? "")}
      </p>
    </form>
  );
}
