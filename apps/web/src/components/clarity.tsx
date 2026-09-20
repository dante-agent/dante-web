"use client";

import { useEffect } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";

// Microsoft Clarity(세션 레코딩·히트맵). 프로젝트 ID(NEXT_PUBLIC_CLARITY_ID)가 없으면
// 아무것도 넣지 않는다. google-analytics.tsx 와 같은 얼개다 — 라이브러리를 하나 더 걸지
// 않고 태그 로더 몇 줄을 직접 넣는다(AGENTS.md).
//
// 다만 GA 와 달리 클라이언트 컴포넌트다. 로그인 사용자를 세션에 붙이려면(identify) 브라우저
// 세션을 읽어야 해서다. 붙이는 값은 최소한 — user id 와 로그인 여부뿐이고, email 같은
// 개인정보는 보내지 않는다(세션 레코딩에 신원이 그대로 남지 않게).
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

declare global {
  interface Window {
    // 로더 스텁이 만드는 명령 큐. 태그가 다 받아지기 전에 부른 호출도 여기 쌓였다가 실행된다.
    clarity?: (...args: unknown[]) => void;
  }
}

export function Clarity() {
  // 로컬(next dev)에서는 붙이지 않는다 — 개발하면서 남긴 세션·클릭이 실제 레코딩에 섞이면
  // 사람 행동을 볼 수 없게 된다. GA 와 같은 이유로 프로덕션에서만 켠다.
  const enabled = Boolean(CLARITY_ID) && process.env.NODE_ENV === "production";

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    // onAuthStateChange 는 구독 직후 INITIAL_SESSION 으로 현재 세션을 한 번 준다.
    // 초기 로드와 이후 로그인/로그아웃을 이 구독 하나로 처리한다.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.clarity?.("identify", session.user.id);
        window.clarity?.("set", "logged_in", "true");
      } else {
        window.clarity?.("set", "logged_in", "false");
      }
    });

    return () => subscription.unsubscribe();
  }, [enabled]);

  if (!enabled) return null;

  return (
    // 인라인 스크립트에는 id 가 필요하다 — next/script 가 이 값으로 중복 실행을 막는다.
    // 프로젝트 ID 는 JSON.stringify 로 감싼다. 문자열을 그대로 이어 붙이는 자리는 한 번
    // 어긋나면 스크립트 전체가 깨진다.
    <Script id="clarity-init" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script",${JSON.stringify(CLARITY_ID)});`}
    </Script>
  );
}
