"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";
import { createClient } from "@/lib/supabase/client";

// OAuth 시작은 브라우저에서 한다.
// signInWithOAuth 가 PKCE 의 code_verifier 를 쿠키에 심고 GitHub 로 보내는데,
// 그 쿠키를 나중에 /auth/callback(서버)이 읽어서 code 를 세션으로 바꾼다.
// 그래서 "시작은 브라우저 / 교환은 서버" 조합이 성립한다.
export function SocialLoginButtons({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signInWithGitHub() {
    setPending(true);
    setFailed(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        // 배포 환경마다 도메인이 다르므로(로컬·프리뷰·프로덕션) 현재 origin 을 그대로 쓴다.
        // 이 URL 은 Supabase 대시보드 Authentication → URL Configuration 에 등록돼 있어야 한다.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    // 성공하면 위 호출이 알아서 GitHub 로 이동시킨다(그래서 pending 을 다시 내리지 않는다).
    // 여기로 돌아왔다는 건 이동조차 못 했다는 뜻 — 대개 Supabase 설정/네트워크 문제다.
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      <Button
        variant="outline"
        size="lg"
        className="h-10 w-full gap-2.5"
        onClick={signInWithGitHub}
        disabled={pending}
      >
        <GitHubIcon className="size-4" />
        Continue with GitHub
      </Button>
      {/* Google 은 아직 Supabase 프로바이더 설정 전이라 눌러도 할 수 있는 게 없다.
          죽은 버튼으로 두느니 비활성으로 두고, 연결하는 PR 에서 푼다. */}
      <Button variant="outline" size="lg" className="h-10 w-full gap-2.5" disabled>
        <GoogleIcon className="size-4" />
        Continue with Google
      </Button>

      {failed && (
        <p role="alert" className="text-destructive text-center text-sm">
          Could not start sign in. Please try again.
        </p>
      )}
    </div>
  );
}
