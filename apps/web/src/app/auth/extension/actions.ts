"use server";

import { requireUser, syncUser } from "@/lib/auth/user";
import { buildDenyUrl, issueAuthCode, parseAuthorizeParams } from "@/lib/extension/auth";

/**
 * 동의 화면의 "연결" 버튼. 1회용 code 를 만들고, 에디터로 돌아갈 URL 을 돌려준다.
 * 수동 모드(redirect=manual)면 URL 대신 화면에 보여줄 code 를 돌려준다.
 *
 * redirect() 로 바로 보내지 않고 URL 을 돌려주는 이유: 목적지가 vscode:// 같은
 * 커스텀 스킴이라 브라우저는 "에디터 열기" 확인창만 띄우고 이 페이지에 머문다.
 * 페이지가 URL 을 쥐고 있어야 확인창을 놓쳤을 때 "다시 열기"를 보여줄 수 있다.
 */
export async function approveExtension(params: Record<string, string>) {
  const user = await requireUser();

  // 클라이언트가 되돌려준 값이라, 페이지에서 검사했어도 다시 본다.
  const request = parseAuthorizeParams(params);
  if (!request) return { ok: false as const };

  // code 가 users 를 FK 로 참조한다. 방금 가입한 사용자는 아직 행이 없을 수 있다.
  await syncUser(user);
  const issued = await issueAuthCode(user.id, request);
  return { ok: true as const, issued };
}

/**
 * 동의 화면의 "취소" 버튼. `error=access_denied` 를 붙여 에디터로 돌아갈 URL 을 돌려준다.
 * 에디터가 이걸 받아야 대기 중인 로그인(state·verifier)을 버린다. 수동 모드는 url 이 null 이다.
 *
 * DB 에는 아무것도 쓰지 않으므로 syncUser 는 부르지 않는다.
 */
export async function denyExtension(params: Record<string, string>) {
  await requireUser();

  // 취소라도 redirect 재검증은 뺄 수 없다. 클라이언트가 되돌려준 값은 다시 믿지 않는다 —
  // 검사 없이 붙이면 이 액션이 아무 스킴으로나 브라우저를 보내는 오픈 리다이렉트가 된다.
  const request = parseAuthorizeParams(params);
  if (!request) return { ok: false as const };

  return { ok: true as const, url: buildDenyUrl(request) };
}
