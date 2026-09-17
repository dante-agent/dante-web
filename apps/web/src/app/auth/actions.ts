"use server";

import { redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { DEFAULT_NEXT, LOGIN_PATH } from "@/lib/auth/redirect";
import { syncUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { rememberCurrentTeam } from "@/lib/teams/current";

// 서버 액션 — <form action={signOut}> 으로 호출한다.
// 서버에서 지워야 세션 쿠키(httpOnly)가 확실히 사라진다.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

/** 심사용 데모 계정이 켜져 있나. 둘 다 있어야 로그인 화면에 Preview 버튼이 뜬다. */
export async function isDemoEnabled() {
  return Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);
}

/**
 * 로그인 화면의 Preview 버튼. 심사관이 아무것도 입력하지 않고 데모 계정으로 들어온다.
 * 비밀번호는 서버 env 에만 있고 브라우저로 나가지 않는다.
 */
export async function signInAsDemo() {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) redirect(LOGIN_PATH);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${LOGIN_PATH}?error=demo`);

  // /auth/callback 과 같다 — 미러 행·개인 팀을 챙기고 지금 팀을 개인 팀으로 둔다.
  const { personalTeamId } = await syncUser(data.user);
  await rememberCurrentTeam(personalTeamId);

  // 연결해 둔 데모 프로젝트가 있으면 대시보드로 바로 보낸다. 없으면(연결 전) 프로젝트 목록.
  const project = await prisma.project.findFirst({
    where: { teamId: personalTeamId, ...accessibleProjectWhere(data.user.id) },
    orderBy: { createdAt: "desc" },
    select: { ref: true },
  });
  redirect(project ? `/project/${project.ref}/dashboard` : DEFAULT_NEXT);
}
