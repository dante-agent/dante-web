/**
 * AI 채팅이 테스트를 고쳤을 때, 폴더 보기의 Test Code 칸이 새 코드를 타이핑 연출로 보여주도록 알리는 창 이벤트.
 * 채팅(layout)과 FileView(page)는 서로 다른 트리라 props 로 이을 수 없다(requestTestRun 과 같은 방식).
 * 받는 쪽은 열려 있는 파일이 같을 때만 반응한다.
 */
const TYPING_REQUEST = "dante:type-test";

export function requestTestTyping(file: string) {
  window.dispatchEvent(new CustomEvent<string>(TYPING_REQUEST, { detail: file }));
}

/** 이 파일에 대한 타이핑 요청을 받는다. 해제 함수를 돌려준다(useEffect 정리용). */
export function onTestTypingRequest(file: string, handle: () => void) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<string>).detail === file) handle();
  };
  window.addEventListener(TYPING_REQUEST, listener);
  return () => window.removeEventListener(TYPING_REQUEST, listener);
}
