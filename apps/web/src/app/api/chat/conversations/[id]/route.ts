import { NextResponse } from "next/server";
import { deleteConversation, getConversation } from "@/lib/chat/conversations";
import { createClient } from "@/lib/supabase/server";

// AI 채팅 대화 하나: 불러오기(메시지 전부) · 지우기.
// 내 대화가 아니거나 프로젝트 권한이 없으면 둘 다 404 — 있는지 없는지 드러내지 않는다.
const NO_STORE = { "Cache-Control": "private, no-store" };

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/chat/conversations/[id]">
) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "Please sign in.");

  const conversation = await getConversation(userId, (await context.params).id);
  if (!conversation) return fail(404, "Conversation not found.");

  return NextResponse.json(
    {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
      contextTokens: conversation.contextTokens,
      messages: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    },
    { headers: NO_STORE }
  );
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/chat/conversations/[id]">
) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "Please sign in.");

  const deleted = await deleteConversation(userId, (await context.params).id);
  if (!deleted) return fail(404, "Conversation not found.");

  return new Response(null, { status: 204, headers: NO_STORE });
}
