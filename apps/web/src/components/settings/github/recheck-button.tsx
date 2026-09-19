"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { recheckConnection } from "@/app/project/[projectRef]/settings/github/actions";
import { useAnnounce } from "@/components/live-announcer";
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
  // 결과는 공용 알림으로 읽는다. 성공하면 배너가 inert 로 접혀 아래 문구도 트리에서 빠지기 때문이다.
  useAnnounce(pending ? null : state?.message, state);

  return (
    <form action={formAction} className="flex min-w-0 flex-1 items-center gap-3">
      <input type="hidden" name="projectRef" value={projectRef} />

      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        focusableWhenDisabled
        className="shrink-0 rounded-[4px]"
      >
        <RefreshCw
          data-icon="inline-start"
          className={pending ? "animate-spin motion-reduce:animate-none" : undefined}
        />
        Recheck
      </Button>

      {/* 스크린리더에는 위 useAnnounce 가 읽어 주므로 여기는 보이는 문구만 둔다.
          잘리지 않게 줄바꿈을 허용한다 — 오류 문구 끝이 "…" 로 잘리면 무엇을 할지 알 수 없다. */}
      <p
        className={`min-w-0 text-[13px] wrap-break-word ${state?.ok ? "text-brand-mint" : "text-muted-foreground"}`}
      >
        {pending ? "Checking…" : (state?.message ?? "")}
      </p>
    </form>
  );
}
