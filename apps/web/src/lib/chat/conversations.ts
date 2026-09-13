import { prisma, type Prisma } from "@dante/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { decodeCursor, encodeCursor, isUuid } from "./cursor";

export { isUuid };

// ⚠️ 서버 전용. AI 채팅 대화 기록의 읽기·쓰기와 권한 조건을 한곳에 모은다.
//
// 대화는 만든 본인만 본다. 조건은 둘 다 건다:
//   - userId = 나 — 같은 팀원이라도 남의 대화는 못 본다.
//   - 프로젝트에 지금 접근 가능 — 팀에서 빠진 사람이 예전 대화로 그 레포 코드를 다시 보지 못하게.
// 조건이 안 맞으면 "없음"으로 돌려준다(404). 403 을 주면 그런 대화가 있다는 사실이 드러난다.
//
// 제목·본문은 암호문으로 저장한다(lib/crypto/secret.ts). 사용자가 코드나 비밀값을 붙여 넣는다.

export type ChatRole = "user" | "assistant";

/** 대화당 메시지 상한(질문·답 합계). 토큰 상한 전에 걸리는 일은 드물다 — 행 수를 묶는 안전장치. */
export const MAX_MESSAGES = 50;

/**
 * 대화당 컨텍스트 토큰 상한. 화면의 "컨텍스트 %"가 이 값을 100% 로 쓴다(ai-chat.tsx 에 같은 값).
 *
 * 모델 한계(약 40만)가 아니라 원가로 정했다. 매 질문마다 대화 전체가 입력으로 다시 들어가서
 * 한 대화의 원가는 길이의 제곱으로 는다. 5만까지 채우면 대략 $0.4 — 인당 월 한도 $5 의 1할이다.
 */
export const MAX_CONTEXT_TOKENS = 50_000;

/** 목록 한 페이지. 패널이 좁아서 한 번에 많이 그릴 일이 없다. */
const PAGE_SIZE = 20;
/** 목록 제목 길이. 넘으면 자른다. */
const TITLE_LENGTH = 40;

/** 내 대화 + 지금 접근 가능한 프로젝트. 대화를 읽고 지우는 모든 조회가 이 조건을 거친다. */
function ownedWhere(userId: string) {
  return {
    userId,
    project: accessibleProjectWhere(userId),
  } satisfies Prisma.ChatConversationWhereInput;
}

/** 첫 질문을 한 줄로 접은 제목. 따로 물어보지 않는다. */
function titleOf(question: string): string {
  const oneLine = question.trim().replace(/\s+/g, " ");
  return oneLine.length > TITLE_LENGTH ? `${oneLine.slice(0, TITLE_LENGTH)}…` : oneLine;
}

export type ConversationPage = {
  items: { id: string; title: string; updatedAt: string; messageCount: number }[];
  nextCursor: string | null;
};

/** 이 프로젝트에서 내 대화 목록(최근 순). 커서가 망가졌으면 null. */
export async function listConversations(
  userId: string,
  projectRef: string,
  cursor: string | null
): Promise<ConversationPage | null> {
  const after = cursor ? decodeCursor(cursor) : null;
  if (cursor && !after) return null;

  const rows = await prisma.chatConversation.findMany({
    where: {
      userId,
      project: { ref: projectRef, ...accessibleProjectWhere(userId) },
      // 정렬(updatedAt desc, id desc)에서 커서 다음 행부터.
      ...(after && {
        OR: [
          { updatedAt: { lt: after.updatedAt } },
          { updatedAt: after.updatedAt, id: { lt: after.id } },
        ],
      }),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    // 한 개 더 읽어서 다음 페이지가 있는지 본다 — count 질의를 따로 하지 않으려고.
    take: PAGE_SIZE + 1,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      title: decryptSecret(row.title),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
    })),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.updatedAt, last.id) : null,
  };
}

export type ConversationDetail = {
  id: string;
  projectId: string;
  title: string;
  updatedAt: Date;
  contextTokens: number;
  messages: { role: ChatRole; content: string; createdAt: Date }[];
};

/** 대화 하나와 메시지 전부(오래된 순). 상한이 50개라 나눠 읽지 않는다. 내 것이 아니면 null. */
export async function getConversation(
  userId: string,
  id: string
): Promise<ConversationDetail | null> {
  if (!isUuid(id)) return null;

  const row = await prisma.chatConversation.findFirst({
    where: { id, ...ownedWhere(userId) },
    select: {
      id: true,
      projectId: true,
      title: true,
      updatedAt: true,
      contextTokens: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, createdAt: true },
      },
    },
  });
  if (!row) return null;

  return {
    ...row,
    title: decryptSecret(row.title),
    messages: row.messages.map((m) => ({
      // 저장하는 곳이 saveExchange 하나라 두 값뿐이다.
      role: m.role as ChatRole,
      content: decryptSecret(m.content),
      createdAt: m.createdAt,
    })),
  };
}

/** 지웠으면 true, 내 것이 아니거나 없으면 false. 메시지는 cascade 로 같이 지워진다. */
export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { count } = await prisma.chatConversation.deleteMany({
    where: { id, ...ownedWhere(userId) },
  });
  return count > 0;
}

/**
 * 질문·답 한 쌍을 저장한다. 답이 정상으로 끝났을 때만 부른다(중단한 답은 질문도 남기지 않는다).
 *
 * 중첩 create 한 번이라 대화 생성과 메시지 두 개가 한 트랜잭션으로 들어간다.
 * askedAt 을 따로 받는 이유: 두 메시지의 createdAt 이 같으면 정렬에서 질문·답 순서가 흔들린다.
 * ponytail: 같은 대화에 동시에 두 번 보내면 상한(50)을 한 쌍 넘길 수 있다 — 막아야 하면 행 잠금.
 */
export async function saveExchange(input: {
  conversationId: string;
  isNew: boolean;
  userId: string;
  projectId: string;
  question: string;
  answer: string;
  filePath: string | null;
  askedAt: Date;
  contextTokens: number;
}): Promise<void> {
  const messages = {
    create: [
      {
        role: "user",
        content: encryptSecret(input.question),
        filePath: input.filePath,
        createdAt: input.askedAt,
      },
      { role: "assistant", content: encryptSecret(input.answer), filePath: input.filePath },
    ],
  } satisfies Prisma.ChatMessageCreateNestedManyWithoutConversationInput;

  if (input.isNew) {
    await prisma.chatConversation.create({
      data: {
        id: input.conversationId,
        userId: input.userId,
        projectId: input.projectId,
        title: encryptSecret(titleOf(input.question)),
        contextTokens: input.contextTokens,
        messages,
      },
    });
  } else {
    // updatedAt 을 직접 넣는다. 중첩 쓰기만 있으면 부모 행에 UPDATE 가 안 나가서
    // @updatedAt 이 안 바뀔 수 있다 — 그러면 이어 쓴 대화가 목록 위로 안 올라온다.
    await prisma.chatConversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date(), contextTokens: input.contextTokens, messages },
    });
  }
}
