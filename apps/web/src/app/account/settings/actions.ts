"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@dante/db";
import { MAX_AI_INSTRUCTIONS, normalizeAiInstructions, parseAiPersona } from "@/lib/ai/persona";
import { parseAiQuality } from "@/lib/ai/quality";
import { requireUser } from "@/lib/auth/user";

const EXTENSION_SETTINGS_PATH = "/account/settings/extension";
const AI_SETTINGS_PATH = "/account/settings/ai";

export type SaveState = { error?: string; saved?: boolean } | null;

/**
 * 생성 품질 기본값 저장.
 *
 * 폼 값은 클라이언트가 보낸 문자열이라 quality.ts 의 선택지로 좁힌 뒤에만 쓴다.
 * 모르는 값을 그대로 저장하면 읽는 쪽이 매번 standard 로 되돌려 읽게 되고, 화면에는
 * 저장됐다고 뜬다.
 */
export async function saveAiQuality(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireUser();

  const quality = parseAiQuality(formData.get("quality"));
  if (!quality) return { error: "Pick Standard or Deep." };

  await prisma.user.update({ where: { id: user.id }, data: { aiQuality: quality } });

  revalidatePath(AI_SETTINGS_PATH);
  return { saved: true };
}

/**
 * 채팅 스타일(성격 프리셋 + 지시문) 저장.
 *
 * 지시문 길이는 여기서 막는다. 폼의 maxLength 는 클라이언트가 우회할 수 있고, 긴 값이
 * 저장되면 매 질문 입력 토큰으로 사용자 한도를 조용히 깎는다.
 */
export async function saveAiChatStyle(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireUser();

  const persona = parseAiPersona(formData.get("persona"));
  if (!persona) return { error: "Pick a style." };

  const instructions = normalizeAiInstructions(formData.get("instructions"));
  if (instructions && instructions.length > MAX_AI_INSTRUCTIONS) {
    return { error: `Keep instructions under ${MAX_AI_INSTRUCTIONS} characters.` };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { aiPersona: persona, aiInstructions: instructions },
  });

  revalidatePath(AI_SETTINGS_PATH);
  return { saved: true };
}

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
