// 목록에서 한 줄을 지우면 그 줄의 버튼이 DOM 에서 빠져 포커스가 body 로 떨어진다.
// 지우기 전에 옮겨 갈 자리를 고른다: 다음 줄 → 이전 줄 → 목록 자체.
//
// 줄에는 data-row, 목록 컨테이너에는 data-rows 를 단다. 목록은 마지막 줄까지 지워졌을 때
// 포커스를 받을 수 있게 tabIndex={-1} 을 준다.
export function neighborFocusTarget(from: Element | null): HTMLElement | null {
  const row = from?.closest("[data-row]");
  const list = from?.closest<HTMLElement>("[data-rows]");
  if (!row || !list) return null;
  const rows = Array.from(list.querySelectorAll("[data-row]"));
  const index = rows.indexOf(row);
  const neighbor = rows[index + 1] ?? rows[index - 1];
  return neighbor?.querySelector<HTMLElement>("a[href], button:not(:disabled)") ?? list;
}
