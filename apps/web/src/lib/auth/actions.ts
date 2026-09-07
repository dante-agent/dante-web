"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 로그인 시작을 브라우저가 아니라 서버에서 하는 이유:
// PKCE 방식은 code_verifier 라는 임시 비밀값을 만들어 뒀다가 콜백에서 다시 꺼내 쓴다.
// 서버 클라이언트로 시작하면 그 값이 쿠키에 담기고, 콜백 라우트가 같은 쿠키를 읽어
// 세션으로 교환할 수 있다. 버튼 하나 때문에 클라이언트 컴포넌트를 만들 필요도 없다.
export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getOrigin()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/auth/error");
  }

  // Google 동의 화면으로 보낸다. redirect() 는 예외를 던져 흐름을 끊으므로 아래는 없다.
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// 배포 환경(Vercel)에서는 프록시를 거치므로 host 가 아니라 x-forwarded-* 를 봐야
// 사용자가 실제로 보는 주소가 나온다. 이 주소가 Supabase 의 Redirect URL 목록과
// 정확히 일치해야 로그인이 통과한다.
async function getOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}
