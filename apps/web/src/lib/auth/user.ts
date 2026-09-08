import { redirect } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@dante/db";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// ⚠️ 서버 전용.

/**
 * 로그인한 Supabase 사용자. 없으면 로그인 화면으로 보낸다.
 *
 * getUser() 는 매번 Supabase 서버에 토큰을 검증받는다. getSession() 은 쿠키를
 * 그대로 믿으므로 권한 판단에 쓰면 안 된다.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** GitHub 로그인으로 들어온 사용자의 GitHub 핸들·숫자 ID. 다른 프로바이더면 null. */
export function githubIdentity(user: SupabaseUser) {
  const meta = user.user_metadata ?? {};
  const login = typeof meta.user_name === "string" ? meta.user_name : null;

  // provider_id 는 프로바이더가 주는 사용자 식별자다. GitHub 은 숫자지만
  // Google 은 숫자가 아닌 sub 이라, 숫자일 때만 GitHub ID 로 취급한다.
  const raw = meta.provider_id;
  const id = typeof raw === "string" && /^\d+$/.test(raw) ? BigInt(raw) : null;

  return { login, id };
}

/**
 * auth.users → public.users 미러링.
 *
 * Prisma 로 FK 를 걸려면 public.users 에 행이 먼저 있어야 한다. auth 스키마는
 * Supabase 가 관리해서 직접 FK 를 걸 수 없기 때문에(AGENTS.md), 로그인 사용자를
 * 처음 쓰는 시점마다 upsert 해둔다.
 */
export async function syncUser(user: SupabaseUser) {
  const github = githubIdentity(user);
  const fields = {
    email: user.email ?? null,
    githubLogin: github.login,
    githubId: github.id,
  };

  return prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, ...fields },
    // 로그인마다 최신 값으로 덮는다 — GitHub 핸들은 바뀔 수 있다.
    update: fields,
  });
}
