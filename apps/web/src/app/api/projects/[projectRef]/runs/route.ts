import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/user";
import { runTestVersion } from "@/lib/projects/run-version";

// 저장된 테스트 버전을 실행한다. 세션 상세의 실행 터미널이 부른다.
//
// Route Handler 로 둔 이유: 러너는 동기로 몇 분까지 열려 있으므로, 함수 실행
// 시간을 늘려 잡아야 한다(maxDuration). 서버 액션으로는 이 상한을 명시하기 어렵다.
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectRef: string }> }
) {
  const { projectRef } = await params;
  const user = await requireUser();

  const body: unknown = await request.json().catch(() => null);
  const versionId =
    body && typeof body === "object" && "versionId" in body && typeof body.versionId === "string"
      ? body.versionId
      : null;
  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const result = await runTestVersion(projectRef, user.id, versionId);
  return NextResponse.json(result);
}
