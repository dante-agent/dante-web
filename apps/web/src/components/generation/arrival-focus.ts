// 생성이 끝나 세션 상세로 넘어가면 누른 버튼·연출 화면이 통째로 사라져 포커스가 body 로 떨어진다.
// 넘기기 직전에 표시해 두면, 도착한 세션 화면의 제목(h1)이 포커스를 받는다(SessionTitle).
// 사이드바로 세션을 옮겨 다닐 때는 표시가 없어 포커스를 건드리지 않는다.
let pending = false;

/** 생성 뒤 세션 화면으로 이동하기 직전에 부른다. */
export function requestArrivalFocus() {
  pending = true;
}

/** 도착한 화면이 한 번 꺼내 쓴다. 표시가 있었는지 돌려주고 지운다. */
export function takeArrivalFocus(): boolean {
  const had = pending;
  pending = false;
  return had;
}
