"use server";

import { redirect } from "next/navigation";
import { accountConfirmation, deleteAccountData, soleOwnerTeams } from "@/lib/account/delete";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { requireUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { message: string } | null;

/**
 * 계정 삭제. 되살리기는 없다. 규칙은 lib/account/delete.ts.
 *
 * 순서: auth 사용자 → DB. auth 삭제가 실패하면 아무것도 지우지 않고 돌려보낸다.
 * 반대 순서면 DB 를 지운 뒤 auth 삭제가 실패했을 때 사용자가 그대로 로그인하고,
 * syncUser 가 빈 계정과 새 개인 팀을 다시 만든다.
 *
 * auth 를 지운 뒤 DB 정리가 실패하면 고아 행이 남는다. 그 사람은 다시 로그인할 수 없고
 * (같은 이메일로 가입하면 새 id 가 나온다) 권한 검사는 전부 세션 기준이라 남은 행에
 * 닿을 길이 없다. 로그로 남겨 운영자가 치운다.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const user = await requireUser();

  // 버튼은 입력이 맞을 때만 눌리지만 그건 화면 사정이다. 서버 액션은 POST 로 직접 부를 수 있다.
  if (String(formData.get("confirmation") ?? "") !== accountConfirmation(user)) {
    return { message: "That does not match your account." };
  }

  const blocking = await soleOwnerTeams(user.id);
  if (blocking.length > 0) {
    const names = blocking.map((team) => team.name).join(", ");
    return {
      message: `You're the only owner of ${names}. Make someone else an owner or delete the team first.`,
    };
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account-delete] auth 사용자 삭제 실패", user.id, error);
    return { message: "Your account couldn't be deleted. Try again in a moment." };
  }

  try {
    await deleteAccountData(user.id);
  } catch (dbError) {
    console.error(
      "[account-delete] auth 는 지웠지만 DB 정리 실패 — 수동 정리 필요",
      user.id,
      dbError
    );
  }

  // 서버 세션은 auth 사용자와 함께 이미 죽었다. 남은 쿠키만 지운다(local) — 서버에
  // 로그아웃을 요청하면 없는 사용자라 실패한다.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}
