import { cache } from "react";
import { redirect } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@dante/db";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { ensurePersonalTeam } from "@/lib/teams/personal";

// ⚠️ 서버 전용.

/**
 * 화면·액션이 쓰는 로그인 사용자. JWT 클레임에 들어 있는 값만 둔다.
 *
 * Supabase 의 User 전체가 아닌 이유: 그걸 받으려면 getUser() 로 Auth 서버에 왕복해야
 * 한다. 우리가 읽는 값(id·이메일·프로바이더·프로필)은 전부 토큰 안에 있다.
 */
export type AuthUser = Pick<SupabaseUser, "id" | "email" | "app_metadata" | "user_metadata">;

/**
 * layout·page 가 같은 요청에서 각각 requireUser() 를 부르므로 cache 로 dedup.
 * redirect 는 캐시 밖(requireUser)에서 던진다.
 *
 * getClaims() 는 JWT 서명을 공개키로 검증하므로 권한 판단에 써도 된다. getSession() 은
 * 쿠키를 그대로 믿으므로 쓰면 안 된다. 다만 토큰이 만료되기 전(최대 1시간)에는 서버에서
 * 끊긴 세션도 통과한다 — 되돌릴 수 없는 동작은 requireVerifiedUser() 를 쓴다.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return {
    id: claims.sub,
    email: claims.email,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
  };
});

/** 로그인한 사용자. 없으면 로그인 화면으로 보낸다. */
export async function requireUser() {
  const user = await getAuthUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * Supabase Auth 서버에 세션이 아직 살아 있는지까지 확인한다. 계정 삭제처럼 되돌릴 수
 * 없는 동작에서만 부른다 — 요청마다 왕복이 한 번 는다.
 */
export async function requireVerifiedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * PR 코멘트에 적을 사용자 이름. GitHub 핸들이 있으면 그것, 없으면 이메일.
 * Re-run 을 누른 사람을 적을 때 쓴다. 코멘트는 레포 사람들이 보니 이메일은 최후 수단이다.
 */
export function requesterLabel(user: AuthUser) {
  return githubIdentity(user).login ?? user.email ?? "a team member";
}

/** GitHub 로그인으로 들어온 사용자의 GitHub 핸들·숫자 ID. 다른 프로바이더면 null. */
export function githubIdentity(user: AuthUser) {
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
export function avatarUrl(user: AuthUser) {
  const meta = user.user_metadata ?? {};
  const url = meta.avatar_url ?? meta.picture;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/** 화면에 쓸 이름. GitHub 핸들 → 이름 → 이메일 앞부분 순으로 있는 걸 쓴다. */
export function displayName(user: AuthUser) {
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
 *
 * 개인 팀도 여기서 같이 챙긴다. 미러 행이 생기는 자리가 곧 가입 시점이라, 이 함수를
 * 거친 사용자는 모두 팀을 하나 이상 가진다(lib/teams/personal.ts).
 */
export async function syncUser(user: AuthUser) {
  const github = githubIdentity(user);
  const fields = {
    email: user.email ?? null,
    githubLogin: github.login,
    githubId: github.id,
    avatarUrl: avatarUrl(user),
  };

  // 값이 그대로면 쓰지 않는다. upsert 는 같은 값이어도 UPDATE(와 updatedAt 갱신)를 한다.
  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  const unchanged =
    existing &&
    existing.email === fields.email &&
    existing.githubLogin === fields.githubLogin &&
    existing.githubId === fields.githubId &&
    existing.avatarUrl === fields.avatarUrl;

  const row = unchanged
    ? existing
    : await prisma.user.upsert({
        where: { id: user.id },
        create: { id: user.id, ...fields },
        // 바뀐 값은 최신으로 덮는다 — GitHub 핸들은 바뀔 수 있다.
        update: fields,
      });

  const personalTeamId = await ensurePersonalTeam(row.id, displayName(user));
  return { ...row, personalTeamId };
}
