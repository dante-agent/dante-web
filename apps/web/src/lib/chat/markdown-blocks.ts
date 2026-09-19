// 스트리밍 중인 AI 답을 최상위 마크다운 블록으로 나눈다(chat-markdown.tsx).
//
// 답 전체를 조각마다 다시 파싱하면 답 길이에 대해 O(n²) 이다. 블록으로 나누면 다 끝난 블록은
// 글자가 그대로라 memo 로 건너뛰고, 자라는 마지막 블록만 다시 파싱한다.
//
// 나눈 결과를 따로 그려도 전체를 한 번에 그린 것과 같아야 한다. 그래서 확실한 곳에서만 나눈다:
// 코드펜스 밖의 빈 줄이고, 다음 줄이 앞 블록에 이어 붙을 수 없는 글자로 시작할 때.
// - 들여쓴 줄: 목록 항목·들여쓴 코드가 빈 줄 너머로 이어진다
// - 목록 기호(- * + 숫자), 인용(>), 표(|): 앞 목록·인용에 붙어 모양이 바뀔 수 있다
// 참조 링크 정의(`[x]: url`)·각주(`[^1]`)·HTML 블록(`<`)은 멀리 떨어진 블록끼리 이어 주므로
// 보이면 나누지 않고 통째로 돌려준다(한 번에 파싱 = 기존과 같음).

/** 줄 첫머리가 이것이면 빈 줄 너머 앞 블록에 이어 붙을 수 있다. */
const CONTINUES = /^[\s>\-*+|\d]/;
/** 멀리 떨어진 블록끼리 잇는 문법. 보이면 나누지 않는다. */
const LINKS_BLOCKS = /^ {0,3}[<[]/;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let start = 0;
  let fence: { char: string; size: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = FENCE.exec(line);

    if (fence) {
      // 닫는 펜스: 같은 글자, 여는 것 이상 길이, 뒤엔 공백만.
      if (
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.size &&
        !marker[2].trim()
      )
        fence = null;
      continue;
    }
    // 백틱 펜스의 정보 문자열엔 백틱이 올 수 없다(오면 펜스가 아니라 인라인 코드).
    if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
      fence = { char: marker[1][0], size: marker[1].length };
      continue;
    }
    if (LINKS_BLOCKS.test(line) || line.includes("[^")) return [text];

    const next = lines[i + 1];
    if (line.trim() === "" && next !== undefined && next.trim() !== "" && !CONTINUES.test(next)) {
      blocks.push(lines.slice(start, i).join("\n"));
      start = i + 1;
    }
  }
  blocks.push(lines.slice(start).join("\n"));
  return blocks.filter((block) => block.trim() !== "");
}
