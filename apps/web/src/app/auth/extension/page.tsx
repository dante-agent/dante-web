import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import danteLogo from "@/assets/dante-logo.png";
import { ExtensionConsent } from "@/components/auth/extension-consent";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { displayName } from "@/lib/auth/user";
import { parseAuthorizeParams, toAuthorizeParams } from "@/lib/extension/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connect extension" };

// 익스텐션 로그인 동의 화면 (dante-extension 결정 D-6). 익스텐션이 브라우저로 이 주소를 연다.
//
// /auth/* 는 OAuth 콜백 때문에 proxy 가 로그인 검사를 하지 않는 공개 경로다.
// 그래서 로그인 확인과 "로그인 후 여기로 되돌아오기(?next)"를 이 페이지가 직접 한다.
export default async function ExtensionAuthPage({ searchParams }: PageProps<"/auth/extension">) {
  const params = await searchParams;
  const request = parseAuthorizeParams(params);

  if (!request) {
    return (
      <Frame>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          This link doesn&apos;t work
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Start signing in again from the Dante extension in your editor.
        </p>
      </Frame>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(`/auth/extension?${query}`)}`);
  }

  return (
    <Frame>
      <ExtensionConsent
        editor={request.editor}
        account={user.email ?? displayName(user)}
        manual={request.delivery.kind === "manual"}
        params={toAuthorizeParams(request)}
      />
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background-warm flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        {/* 로그인 화면과 같은 이유로 표시 크기를 CSS 로 못박는다 (src/app/page.tsx). */}
        <Image
          src={danteLogo}
          alt="Dante"
          priority
          draggable={false}
          className="h-8 w-6 select-none"
        />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
