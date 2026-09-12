"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";

const EXTENSION_SETTINGS_PATH = "/account/settings/extension";

/** uuid 모양만 본다. @db.Uuid 컬럼에 아무 문자열이나 넣으면 Postgres 가 던진다. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 연결된 에디터 하나를 끊는다(토큰 폐기).
 *
 * lib/extension/auth.ts 의 revokeExtensionToken 은 쓰지 않는다 — id 만 받고
 * 소유자를 보지 않아서, 폼에 남의 토큰 id 를 넣어 보내면 그대로 지워진다.
 * (그쪽은 Bearer 로 인증한 자기 토큰 id 만 넘기니 문제없다.) 여기서는 userId 를
 * where 에 같이 넣어 "내 토큰"일 때만 지운다.
 *
 * 끊긴 에디터의 다음 요청은 401 이 되고, 다시 로그인해야 한다.
 */
export async function revokeExtensionConnection(formData: FormData) {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) return;

  // 없는 행(이미 끊었거나 남의 것)이어도 조용히 넘어간다 — 두 번 눌러도 터지지 않게.
  await prisma.extensionToken.deleteMany({ where: { id, userId: user.id } });

  revalidatePath(EXTENSION_SETTINGS_PATH);
}
