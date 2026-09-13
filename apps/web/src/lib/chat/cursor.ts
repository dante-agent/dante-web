// 대화 목록 커서와 id 검사. DB 없이 테스트하려고 conversations.ts 에서 떼어 뒀다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 클라이언트가 보낸 id 가 uuid 모양인지. 아니면 Prisma 가 @db.Uuid 캐스팅에서 500 으로 터진다. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * 목록 커서. `updatedAt|id` 를 base64url 로 감싼 불투명 문자열이다.
 *
 * offset 이 아니라 값 기준(keyset)인 이유: 대화를 이어 쓰면 updatedAt 이 바뀌어 맨 위로
 * 올라간다. offset 으로 넘기면 그 사이에 순서가 밀려 항목이 중복되거나 빠진다.
 * Prisma 의 cursor 옵션(id 기준)은 커서 행이 지워지면 페이지가 깨져서 쓰지 않는다.
 */
export function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`).toString("base64url");
}

/** 망가졌거나 조작된 커서면 null. */
export function decodeCursor(cursor: string): { updatedAt: Date; id: string } | null {
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const updatedAt = new Date(iso ?? "");
  if (Number.isNaN(updatedAt.getTime()) || !isUuid(id)) return null;
  return { updatedAt, id };
}
