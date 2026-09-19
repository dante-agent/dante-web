"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";
import { useAnnounce } from "@/components/live-announcer";
import { createClient } from "@/lib/supabase/client";

// GitHub·Google 둘 다 흐름이 같아서 provider 만 바꿔 끼운다.
type Provider = "github" | "google";

// OAuth 시작은 브라우저에서 한다.
// signInWithOAuth 가 PKCE 의 code_verifier 를 쿠키에 심고 프로바이더로 보내는데,
// 그 쿠키를 나중에 /auth/callback(서버)이 읽어서 code 를 세션으로 바꾼다.
// 그래서 "시작은 브라우저 / 교환은 서버" 조합이 성립한다.
export function SocialLoginButtons({ next }: { next: string }) {
  // 어느 버튼을 눌렀는지까지 담는다 — 누른 쪽만 스피너 없이도 구분할 수 있고,
  // 이동하는 동안 두 버튼을 함께 잠글 수 있다.
  const [pending, setPending] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(false);
  // 누르면 버튼만 잠기고 화면 글자는 그대로라, 이동 중이라는 것을 스크린리더에 알린다.
  useAnnounce(pending === "github" ? "Redirecting to GitHub…" : null);

  async function signIn(provider: Provider) {
    setPending(provider);
    setFailed(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // 배포 환경마다 도메인이 다르므로(로컬·프리뷰·프로덕션) 현재 origin 을 그대로 쓴다.
        // 이 URL 은 Supabase 대시보드 Authentication → URL Configuration 에 등록돼 있어야 한다.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    // 성공하면 위 호출이 알아서 프로바이더로 이동시킨다(그래서 pending 을 다시 내리지 않는다).
    // 여기로 돌아왔다는 건 이동조차 못 했다는 뜻 — 대개 Supabase 설정/네트워크 문제다.
    if (error) {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      <Button
        variant="outline"
        size="lg"
        className="h-10 w-full gap-2.5"
        onClick={() => signIn("github")}
        disabled={pending !== null}
        focusableWhenDisabled
      >
        <GitHubIcon className="size-4" />
        Continue with GitHub
      </Button>
      {/* Google 로그인은 아직 열지 않는다. 자리만 보여주고 누르지 못하게 막아 둔다. */}
      {/* 배지는 오른쪽 끝에 띄워서, 아이콘·문구가 GitHub 버튼과 같은 가운데에 오게 한다.
          버튼 폭이 360px 보다 좁으면 배지가 문구와 겹치므로 숨긴다(버튼은 비활성이라 눌리지 않는다).
          화면 폭이 아니라 버튼 폭을 보는 건, 데스크톱에서도 로그인 칸이 좁아지는 구간이 있어서다. */}
      <Button
        variant="outline"
        size="lg"
        className="@container relative h-10 w-full gap-2.5"
        disabled
      >
        <GoogleIcon className="size-4" />
        Continue with Google
        {/* 배지는 좁으면 숨겨지므로 스크린리더에는 폭과 상관없이 sr-only 글자로 알린다. */}
        <span
          aria-hidden="true"
          className="text-muted-foreground border-border absolute right-2.5 hidden border px-1 py-0.5 font-mono text-[9px] font-bold tracking-[0.06em] @min-[360px]:block"
        >
          COMING SOON
        </span>
        <span className="sr-only">(coming soon)</span>
      </Button>

      {failed && (
        <p role="alert" className="text-destructive text-center text-sm">
          Could not start sign in. Please try again.
        </p>
      )}
    </div>
  );
}
