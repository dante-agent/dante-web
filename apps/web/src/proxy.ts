import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16: middleware.ts → proxy.ts (기능 동일, 파일/export 이름만 변경)
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 파일/이미지 제외 — 나머지 모든 경로에서 세션 갱신
    //
    // api/github/webhook 도 제외한다. GitHub 서버가 부르는 경로라 갱신할 세션이
    // 없는데, 빼지 않으면 배달 한 건마다 Supabase 로 getUser() 왕복이 헛돈다.
    "/((?!api/github/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
