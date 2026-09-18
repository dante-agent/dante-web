import { Prisma, prisma } from "@dante/db";
import { getOwnedProjectId } from "@/lib/projects/queries";

// 추천 세션(TestFileVersion)별 대화를 DB(TestChatThread)에 통째로 저장/조회한다 (서버 전용).
//
// 화면(FollowUp)이 다루는 메시지 배열을 JSON 한 덩이로 담는다. 소유 검증은 여기서 한다 —
// versionId·projectId 는 클라이언트에서 오므로 믿지 않고, 이 사용자 소유 프로젝트에 속한
// 버전일 때만 읽고 쓴다.

/** 저장하는 메시지 한 건. 화면의 ChatMessage 에서 표시에 필요한 값만 추린 것. */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/** 남용을 막는 상한 — 메시지 수와 한 메시지 길이. 넘으면 잘라 저장한다. */
const MAX_MESSAGES = 100;
const MAX_TEXT = 5_000;

/** versionId 가 이 사용자 소유 프로젝트의 버전인지 확인하고 projectId 를 돌려준다. 아니면 null. */
async function ownedVersion(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<string | null> {
  const projectId = await getOwnedProjectId(projectRef, userId);
  if (!projectId) return null;
  const version = await prisma.testFileVersion.findFirst({
    where: { id: versionId, testFile: { component: { projectId } } },
    select: { id: true },
  });
  return version ? projectId : null;
}

/** 세션의 저장된 대화. 없거나 소유가 아니면 빈 배열. */
export async function getGeneratedChat(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<StoredChatMessage[]> {
  if (!(await ownedVersion(projectRef, userId, versionId))) return [];
  const thread = await prisma.testChatThread.findUnique({
    where: { testFileVersionId: versionId },
    select: { messages: true },
  });
  return thread ? sanitize(thread.messages) : [];
}

/** 세션의 대화를 통째로 덮어 저장한다(upsert). 소유가 아니면 아무것도 안 한다. */
export async function saveGeneratedChat(
  projectRef: string,
  userId: string,
  versionId: string,
  messages: StoredChatMessage[]
): Promise<void> {
  if (!(await ownedVersion(projectRef, userId, versionId))) return;
  // 정규화한 뒤 Prisma 의 Json 입력 타입으로 넘긴다(구조화된 배열이라 캐스팅이 필요하다).
  const clean = sanitize(messages) as unknown as Prisma.InputJsonValue;
  await prisma.testChatThread.upsert({
    where: { testFileVersionId: versionId },
    create: { testFileVersionId: versionId, messages: clean },
    update: { messages: clean },
  });
}

/** 신뢰할 수 없는 입력(클라이언트·DB JSON)을 표시용 메시지 배열로 정규화한다. */
function sanitize(value: unknown): StoredChatMessage[] {
  if (!Array.isArray(value)) return [];
  const out: StoredChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, role, text } = item as Record<string, unknown>;
    if (typeof id !== "string") continue;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof text !== "string") continue;
    out.push({ id, role, text: text.slice(0, MAX_TEXT) });
    if (out.length >= MAX_MESSAGES) break;
  }
  return out;
}
