/**
 * 수정 모드에서 채팅 답의 Apply 를 눌렀을 때, 코드를 After 칸에 꽂도록 알리는 창 이벤트.
 * 채팅(layout)과 FileView(page)는 서로 다른 트리라 props 로 이을 수 없다(requestTestTyping 과 같은 방식).
 *
 * 수정 모드에서는 AI 가 파일을 저장하지 않는다(서버가 도구를 주지 않는다). 저장 여부는
 * 사용자가 diff 를 보고 Save 로 정한다 — 이 이벤트는 After 칸의 내용만 바꾼다.
 */
const APPLY_REQUEST = "dante:put-test-in-after";

type ApplyDetail = { file: string; code: string };

export function requestTestApply(file: string, code: string) {
  window.dispatchEvent(new CustomEvent<ApplyDetail>(APPLY_REQUEST, { detail: { file, code } }));
}

/** 이 파일에 대한 요청을 받는다. 해제 함수를 돌려준다(useEffect 정리용). */
export function onTestApplyRequest(file: string, handle: (code: string) => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ApplyDetail>).detail;
    if (detail.file === file) handle(detail.code);
  };
  window.addEventListener(APPLY_REQUEST, listener);
  return () => window.removeEventListener(APPLY_REQUEST, listener);
}

// ── 반대 방향: After 칸 내용을 채팅이 가져간다 ────────────────────────────────
//
// 수정 모드에서 "고쳐줘" 하면 AI 는 저장된 버전이 아니라 사용자가 지금 치고 있는 내용을
// 봐야 한다. 안 그러면 절반쯤 고쳐 둔 걸 못 보고 원본에서 다시 고쳐 내 편집을 되돌린다.
//
// 상태를 흘려보내지 않고 "필요할 때 물어보는" 방식인 이유: 편집 내용은 글자마다 바뀌는데
// 그걸 채팅까지 내려보내면 한 글자 칠 때마다 대화 전체가 다시 그려진다.

let readAfter: (() => string) | null = null;

/** FileView 가 수정 모드일 때 등록한다. 해제 함수를 돌려준다(useEffect 정리용). */
export function provideAfterCode(read: () => string) {
  readAfter = read;
  return () => {
    // 다른 파일의 FileView 가 이미 등록했으면 그건 건드리지 않는다.
    if (readAfter === read) readAfter = null;
  };
}

/** 지금 After 칸 내용. 수정 모드가 아니면 null. */
export function currentAfterCode(): string | null {
  return readAfter?.() ?? null;
}
