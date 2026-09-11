import { cache } from "react";
import { redirect } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@dante/db";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// ⚠️ 서버 전용.

/**
 * layout·page 가 같은 요청에서 각각 requireUser() 를 부르므로 cache 로 dedup —
 * getUser() 왕복은 요청당 한 번. redirect 는 캐시 밖(requireUser)에서 던진다.
 */
const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * 로그인한 Supabase 사용자. 없으면 로그인 화면으로 보낸다.
 *
 * getUser() 는 매번 Supabase 서버에 토큰을 검증받는다. getSession() 은 쿠키를
 * 그대로 믿으므로 권한 판단에 쓰면 안 된다.
 */
export async function requireUser() {
  const user = await getAuthUser();
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
 * 프로바이더가 준 프로필 이미지 URL. 없으면 null.
 *
 * GitHub 은 avatar_url 을 그대로 준다. Google 은 picture 로 주는데 Supabase 가
 * avatar_url 로도 복사해준다 — 다만 프로바이더/시점에 따라 한쪽만 있는 경우가
 * 있어 둘 다 본다.
 */
export function avatarUrl(user: SupabaseUser) {
  const meta = user.user_metadata ?? {};
  const url = meta.avatar_url ?? meta.picture;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/** 화면에 쓸 이름. GitHub 핸들 → 이름 → 이메일 앞부분 순으로 있는 걸 쓴다. */
export function displayName(user: SupabaseUser) {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.user_name, meta.full_name, meta.name, user.email?.split("@")[0]];
  const name = candidates.find((v) => typeof v === "string" && v.length > 0);
  return (name as string | undefined) ?? "User";
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
    avatarUrl: avatarUrl(user),
  };

  return prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, ...fields },
    // 로그인마다 최신 값으로 덮는다 — GitHub 핸들은 바뀔 수 있다.
    update: fields,
  });
}
