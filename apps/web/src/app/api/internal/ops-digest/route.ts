import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isDiscordWebhookUrl } from "@/lib/notifications/discord";
import { postDiscordMessage } from "@/lib/notifications/discord-send";
import { renderOpsDigest } from "@/lib/ops/digest";
import { getOpsMetrics } from "@/lib/ops/metrics";
import { siteUrl } from "@/lib/site-url";

// 운영 현황 요약을 Discord 로 보낸다. Vercel Cron 이 정해진 시각에 GET 으로 부른다
// (일정은 vercel.json).
//
// 사용자도 GitHub 도 아닌 호출이라 쿠키가 없다. proxy.ts 가 /api/internal 을 이미
// 세션 갱신에서 빼 두었고, 여기서는 CRON_SECRET 으로 "우리가 건 일정인지"를 본다.
// Vercel Cron 은 그 환경변수가 있으면 Authorization: Bearer <값> 을 자동으로 붙인다.
//
// 형제 라우트(pr-test-run)처럼 HMAC 서명을 쓰지 않은 이유: 저쪽은 우리 서버가 페이로드
// (jobId)를 담아 자기 자신을 부르는 경로라 서명할 대상이 있다. 여기는 Vercel 이 부르고
// 우리가 서명을 끼워 넣을 자리가 없다 — 고정 비밀값 비교가 쓸 수 있는 전부다.

// 집계 쿼리 열두어 개 + Discord 왕복. 기본값(10초) 안에 끝나지만 DB 가 느린 날에
// 요약이 통째로 날아가지 않게 조금 여유를 둔다.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? "";
  if (!matches(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 웹훅을 안 걸어 둔 것은 오류가 아니라 "이 알림을 안 쓴다"는 뜻이다. 일정만 돌고
  // 조용히 끝나야 Vercel 의 크론 기록이 빨간색으로 차지 않는다.
  const webhookUrl = process.env.OPS_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ ok: true, skipped: "no webhook" });

  // 서버가 이 주소로 직접 요청을 보낸다. 모양을 고정해 두지 않으면 환경변수를 고칠 수
  // 있는 사람이 우리 서버를 아무 내부 주소로 가는 통로로 쓸 수 있다(discord.ts 참고).
  if (!isDiscordWebhookUrl(webhookUrl)) {
    return NextResponse.json({ error: "webhook url is not a discord webhook" }, { status: 500 });
  }

  const metrics = await getOpsMetrics();
  await postDiscordMessage(webhookUrl, renderOpsDigest(metrics, `${siteUrl()}/ops`));

  return NextResponse.json({ ok: true });
}

/**
 * 길이가 다르면 timingSafeEqual 이 던지므로 먼저 거른다. 길이가 새는 것은 감수한다 —
 * 비밀값 자체가 새는 것과는 다른 이야기다.
 */
function matches(token: string, secret: string) {
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
