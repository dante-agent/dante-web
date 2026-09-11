"use server";

import { requireUser, syncUser } from "@/lib/auth/user";
import { issueAuthCode, parseAuthorizeParams } from "@/lib/extension/auth";

/**
 * 동의 화면의 "연결" 버튼. 1회용 code 를 만들고 에디터로 돌아갈 URL 을 돌려준다.
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
  const url = await issueAuthCode(user.id, request);
  return { ok: true as const, url };
}
