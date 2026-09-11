"use server";

import { Resend } from "resend";
import { displayName, requireUser } from "@/lib/auth/user";

// 헤더 Feedback 모달이 부르는 서버 액션. 받은 글을 서비스팀 메일로 보낸다.
//
// DB 테이블이 아니라 메일인 이유: 문의는 "읽고 답장하면 끝"이라 조회 화면이
// 필요 없고, Resend 는 이미 의존성에 있다. 이력을 화면에서 봐야 할 만큼
// 쌓이면 그때 테이블로 옮긴다.

export type FeedbackState = { error?: string; sent?: boolean } | null;

/** 메일 제목이 통째로 본문이 되지 않게 자른다. */
const MAX_LENGTH = 5000;

export async function sendFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "문의 내용을 입력해주세요." };
  if (message.length > MAX_LENGTH) return { error: `${MAX_LENGTH}자까지 보낼 수 있어요.` };

  // 보낸 사람은 폼이 아니라 세션에서 읽는다 — 남의 이름으로 문의를 넣지 못하게.
  const user = await requireUser();

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[feedback] RESEND_API_KEY / FEEDBACK_TO_EMAIL 이 없다");
    return { error: "지금은 문의를 받을 수 없어요. 잠시 후 다시 시도해주세요." };
  }

  const name = displayName(user);
  // 어느 화면에서 눌렀는지. 재현 못 하는 문의를 줄인다.
  const page = String(formData.get("page") ?? "");

  const { error } = await new Resend(apiKey).emails.send({
    // 도메인을 붙이기 전까지는 Resend 가 주는 onboarding 주소만 쓸 수 있다.
    from: process.env.FEEDBACK_FROM_EMAIL ?? "Dante Feedback <onboarding@resend.dev>",
    to,
    // 답장을 누르면 바로 문의한 사람에게 간다.
    replyTo: user.email ?? undefined,
    subject: `[Feedback] ${name}`,
    text: `${message}\n\n---\n${name} <${user.email ?? "-"}>\nuser: ${user.id}\npage: ${page}`,
  });

  if (error) {
    console.error("[feedback] 전송 실패", error);
    return { error: "전송에 실패했어요. 잠시 후 다시 시도해주세요." };
  }

  return { sent: true };
}
