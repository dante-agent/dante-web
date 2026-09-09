import { NextResponse } from "next/server";
import { handleWebhookEvent, verifySignature } from "@/lib/github/webhook";

// GitHub App 의 Webhook URL. GitHub 이 여기로 POST 를 보낸다.
//
// 로그인한 사용자가 아니라 GitHub 서버가 부르는 유일한 경로다. 그래서 쿠키가 없고,
// 대신 본문 서명(x-hub-signature-256)으로 "정말 GitHub 이 보냈는지"를 확인한다.
// 이 경로는 proxy.ts 의 세션 갱신에서 제외해 두었다 — 확인할 세션이 없다.
//
// 응답 코드는 GitHub 의 재시도 정책과 직결된다:
//   2xx  성공. 다시 안 보낸다
//   그 외 실패로 보고 재시도한다 (App 설정의 Advanced 탭에서 배달 기록을 볼 수 있다)
// 그래서 "우리가 처리하지 않는 이벤트"도 200 으로 받는다. 실패가 아니라 무관심이다.
export async function POST(request: Request) {
  // 파싱 전 원본 문자열이어야 서명이 맞는다. request.json() 을 먼저 부르면 안 된다.
  const body = await request.text();

  let verified: boolean;
  try {
    verified = verifySignature(body, request.headers.get("x-hub-signature-256"));
  } catch {
    // 시크릿이 설정 안 된 경우. 검증할 수 없으면 받지 않는다 — 통과시키면
    // 아무나 이 경로로 "레포 연결 끊김"을 써넣을 수 있다.
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  if (!verified) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (!event) {
    return NextResponse.json({ error: "missing event" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  // 여기서 던지면 500 이 나가고 GitHub 이 재시도한다. DB 가 잠깐 죽은 경우
  // 그 재시도가 곧 복구 수단이라 일부러 잡지 않는다.
  const handled = await handleWebhookEvent(event, payload);

  // 배달 ID 는 App 설정의 배달 기록과 맞춰보는 열쇠다. 처리한 것만 남긴다 —
  // 안 그러면 관심 없는 이벤트(push 등)로 로그가 가득 찬다.
  if (handled) {
    console.log(`[github-webhook] ${request.headers.get("x-github-delivery")} ${handled}`);
  }

  return NextResponse.json({ ok: true });
}
