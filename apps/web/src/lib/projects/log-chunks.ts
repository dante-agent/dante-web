// 실행 터미널의 러너 출력을 조각 배열로 쌓는다. 조각마다 따로 ANSI 를 풀어 그리면(AnsiText memo),
// 로그가 붙을 때 마지막 조각만 다시 풀린다 — 전체 텍스트를 프레임마다 다시 풀지 않는다.
//
// 조각은 줄 끝에서만, 그 지점의 색 상태가 비어 있을 때만(글자색·배경색·굵게 등 없음) 닫는다. 그래야 다음 조각을
// 새로 풀어도 전체를 한 번에 풀 때와 같은 색이 나온다 — 색이 줄을 넘어 이어지는 동안엔 한 조각으로 둔다.

import Anser from "anser";

/** 조각 하나. id 는 React key 로 쓴다 — 상한을 넘어 앞이 잘려도 그대로라 다시 마운트되지 않는다. */
export type LogChunk = { id: number; text: string };

/** 마지막 조각만 열려 있고(계속 자란다) 나머지는 닫혀 바뀌지 않는다. length 는 전체 글자 수. */
export type StepLog = { chunks: LogChunk[]; length: number; nextId: number };

export const EMPTY_LOG: StepLog = { chunks: [], length: 0, nextId: 0 };

/** 열린 조각이 이만큼 자라면 닫을 자리를 찾는다(글자). */
const SEAL_AT = 4096;

/** anser 가 타입으로 내놓지 않는 색 상태. 버전이 바뀌어 없으면 닫지 않는다(한 조각 = 예전과 같다). */
type AnsiState = { fg: unknown; bg: unknown; decorations: unknown };

function isClean(ansi: Anser): boolean {
  const state = ansi as unknown as Partial<AnsiState>;
  return (
    state.fg === null &&
    state.bg === null &&
    Array.isArray(state.decorations) &&
    state.decorations.length === 0
  );
}

/**
 * 조각을 닫을 수 있는 가장 뒤 자리(줄 끝 다음 인덱스). 없으면 0.
 * 줄마다 같은 anser 에 흘려 색 상태를 따라간다 — ESC[ 명령은 줄바꿈을 넘지 않아 한 번에 풀 때와 상태가 같다.
 */
function lastCleanBreak(text: string): number {
  const ansi = new Anser();
  let best = 0;
  let start = 0;
  for (;;) {
    const newline = text.indexOf("\n", start);
    if (newline === -1) return best;
    ansi.ansiToJson(text.slice(start, newline + 1));
    start = newline + 1;
    if (isClean(ansi)) best = start;
  }
}

/** 로그 끝에 text 를 붙이고, 전체가 max 글자를 넘으면 앞을 버린다(잘린 결과는 전체 문자열을 자른 것과 같다). */
export function appendLog(log: StepLog, text: string, max: number): StepLog {
  if (!text) return log;
  let { nextId } = log;
  const chunks = log.chunks.slice(0, -1);
  const open = log.chunks.at(-1) ?? { id: nextId++, text: "" };
  const combined = open.text + text;

  const cut = combined.length >= SEAL_AT ? lastCleanBreak(combined) : 0;
  if (cut > 0 && cut < combined.length) {
    chunks.push({ id: open.id, text: combined.slice(0, cut) });
    chunks.push({ id: nextId++, text: combined.slice(cut) });
  } else if (cut > 0) {
    // 줄 끝에서 딱 끝났다. 닫고 빈 조각을 새로 연다 — 다음 출력이 닫힌 조각에 붙지 않게.
    chunks.push({ id: open.id, text: combined });
    chunks.push({ id: nextId++, text: "" });
  } else {
    chunks.push({ id: open.id, text: combined });
  }

  let length = log.length + text.length;
  while (length > max) {
    const excess = length - max;
    const first = chunks[0];
    if (first.text.length <= excess && chunks.length > 1) {
      chunks.shift();
      length -= first.text.length;
    } else {
      chunks[0] = { id: first.id, text: first.text.slice(excess) };
      length -= excess;
    }
  }
  return { chunks, length, nextId };
}

/** 한 번에 받은 로그(저장된 실행)를 조각으로. */
export function logFromText(text: string): StepLog {
  return appendLog(EMPTY_LOG, text, Infinity);
}
