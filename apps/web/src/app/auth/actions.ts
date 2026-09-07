"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// 서버 액션 — <form action={signOut}> 으로 호출한다.
// 서버에서 지워야 세션 쿠키(httpOnly)가 확실히 사라진다.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
