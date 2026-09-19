// 사이드바에서 세션(버전)을 구분하는 제목을 그 세션에 저장된 대화에서 뽑는다 (DB 없이 순수 함수).
//
// 버전을 만들 때마다 대화 끝에 assistant 알림 한 줄이 붙는다(생성·후속 요청·실패 재생성).
// 대화는 새 버전으로 통째로 이어지고, 그 뒤에 이 세션에서 보낸 요청이 덧붙을 수 있다. 그래서
// "마지막 알림"이 이 버전을 만든 알림이고, 그 바로 앞 사용자 메시지가 이 버전을 만든 요청이다.

/** 후속 요청으로 고친 버전에 붙는 알림(regenerateFromInstruction). */
export const UPDATED_NOTE =
  "Updated the test with your request. Review it on the right and run it.";
/** 실패 로그로 고친 버전에 붙는 알림(regenerateFromFailure). */
export const FIXED_NOTE =
  "Fixed the test based on the failure logs. Review it on the right and run it.";

/** 실패 재생성으로 만든 버전의 제목. 사용자 요청이 없어 고정 문구를 쓴다. */
export const FIXED_LABEL = "Fix failing test";

/** 제목 글자 상한. 사이드바는 어차피 한 줄로 자르지만 긴 프롬프트를 통째로 들고 다니지 않게. */
const MAX_LABEL = 80;

interface LabelMessage {
  role: "user" | "assistant";
  text: string;
}

// 예전 알림("…re-running it now.")도 잡도록 문장 앞부분으로 비교한다.
const FIXED_PREFIX = "Fixed the test based on the failure logs";
/**
 * 버전 알림으로 치는 문장 앞부분. 사이드바 목록은 이 값으로 DB 에서 알림을 찾는다
 * (generated-sessions.ts) — 규칙을 두 군데에 쓰지 않도록 내보낸다.
 */
export const VERSION_NOTE_PREFIXES = [
  "Generated ",
  "Updated the test with your request",
  FIXED_PREFIX,
] as const;
/** 알림 판정에 필요한 앞부분 길이. DB 에서 알림 글자를 이만큼만 가져온다. */
export const VERSION_NOTE_PREFIX_LENGTH = Math.max(...VERSION_NOTE_PREFIXES.map((p) => p.length));

const isFixed = (text: string) => text.startsWith(FIXED_PREFIX);
const isVersionNote = (text: string) => VERSION_NOTE_PREFIXES.some((p) => text.startsWith(p));

/** 이 버전을 만든 요청. 찾을 수 없으면 null(부르는 쪽이 파일 이름으로 대신한다). */
export function sessionLabel(messages: LabelMessage[]): string | null {
  let noteIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant" && isVersionNote(messages[i].text)) {
      noteIndex = i;
      break;
    }
  }
  if (noteIndex === -1) return null;
  if (isFixed(messages[noteIndex].text)) return FIXED_LABEL;

  for (let i = noteIndex - 1; i >= 0; i -= 1) {
    if (messages[i].role !== "user") continue;
    const text = messages[i].text.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, MAX_LABEL) : null;
  }
  return null;
}
