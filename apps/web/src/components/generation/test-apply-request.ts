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
