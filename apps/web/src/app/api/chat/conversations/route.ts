import { NextResponse } from "next/server";
import { listConversations } from "@/lib/chat/conversations";
import { createClient } from "@/lib/supabase/server";

// 이 프로젝트의 한 파일에서 내 AI 채팅 대화 목록. 20개씩, 최근 순, 커서로 "더보기".
// 개인 데이터라 어디에도 캐시하지 않는다.
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: NO_STORE });
  }

  const params = new URL(request.url).searchParams;
  const projectRef = params.get("projectRef");
  const filePath = params.get("filePath");
  if (!projectRef || !filePath) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE });
  }

  // 접근할 수 없는 프로젝트면 빈 목록이다 — 그런 프로젝트가 있는지 드러내지 않는다.
  const page = await listConversations(user.id, projectRef, filePath, params.get("cursor"));
  if (!page) {
    return NextResponse.json(
      {
        error: "Invalid list cursor.\nPlease reload from the start.",
        code: "invalid_cursor",
      },
      { status: 400, headers: NO_STORE }
    );
  }
  return NextResponse.json(page, { headers: NO_STORE });
}
