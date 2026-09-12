import { NextResponse } from "next/server";
import { createTextStreamResponse, streamText, type ModelMessage } from "ai";
import { chatModel } from "@/lib/ai/chat-model";
import { recordAiUsage } from "@/lib/ai/usage";
import { getFileText } from "@/lib/github/blob";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { createClient } from "@/lib/supabase/server";

// 폴더 보기 화면의 AI 채팅.
//
// 대화는 저장하지 않는다 — 클라이언트가 매 요청에 전체 대화를 실어 보내고,
// 새로고침하면 사라진다. 저장하려면 테이블이 하나 필요한데(마이그레이션),
// 대화 기록이 실제로 필요한지부터 써보고 정하는 편이 싸다.
// ponytail: 대화 저장은 ChatSession 모델 추가 시.

/** 컨텍스트로 붙이는 파일 본문 상한(글자). 큰 파일 하나로 토큰을 다 쓰지 않게. */
const MAX_CONTEXT = 20_000;

const SYSTEM = [
  "너는 Dante 의 코드·테스트 도우미다. 사용자의 GitHub 레포 코드에 대해 한국어로 답한다.",
  "짧고 구체적으로 답한다. 코드는 마크다운 코드블록으로 준다.",
  "파일 내용이 주어지지 않았으면 추측하지 말고 무엇을 열어야 하는지 되묻는다.",
].join("\n");

type Body = { projectRef?: unknown; file?: unknown; messages?: unknown };

/** 클라이언트가 보낸 대화는 신뢰 경계 밖이다 — 모양이 맞을 때만 통과시킨다. */
function parseMessages(value: unknown): ModelMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const messages: ModelMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0) return null;
    messages.push({ role, content });
  }
  return messages;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const messages = parseMessages(body.messages);
  if (!messages) {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다.\n새 대화로 다시 시도해주세요." },
      { status: 400 }
    );
  }

  // 열어둔 파일을 컨텍스트로 붙인다. 레포를 읽기 전에 소유 확인을 거친다
  // (projectRef 는 클라이언트가 보낸 값이다).
  let context = "";
  let projectId: string | null = null;
  if (typeof body.projectRef === "string") {
    // 사용량을 어느 프로젝트에 붙일지. 소유 확인을 겸한다 — 남의 ref 를 보내면
    // null 이라 사용량이 그 프로젝트에 붙지 않는다.
    projectId = await getOwnedProjectId(body.projectRef, user.id);

    if (typeof body.file === "string") {
      const repo = await getProjectRepo(body.projectRef, user.id);
      const text = repo ? await getFileText(repo, body.file) : null;
      if (text) {
        context = `\n\n지금 사용자가 보고 있는 파일:\n<file path="${body.file}">\n${text.slice(0, MAX_CONTEXT)}\n</file>`;
      }
    }
  }

  const result = streamText({
    model: chatModel(),
    system: SYSTEM + context,
    messages,
    // 스트림 도중 에러는 throw 되지 않고 스트림으로 흘러간다 — 서버 로그에는 남긴다.
    onError: ({ error }) => console.error("[chat]", error),
    // 사용량은 스트림이 끝나야 확정된다. 여기서만 실제 토큰 수를 알 수 있다.
    // projectId 는 위 소유 확인을 통과한 프로젝트만 쓴다 — 클라이언트가 보낸
    // projectRef 를 그대로 믿으면 남의 프로젝트에 사용량을 붙일 수 있다.
    onFinish: ({ usage }) => recordAiUsage({ userId: user.id, projectId, surface: "chat", usage }),
  });

  return createTextStreamResponse({ stream: result.textStream });
}
