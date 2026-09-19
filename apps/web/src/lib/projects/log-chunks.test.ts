import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Anser from "anser";
import { appendLog, EMPTY_LOG, logFromText, type StepLog } from "./log-chunks.ts";

// 조각으로 나눠 풀어도 전체를 한 번에 풀 때와 글자마다 같은 색인지. 실행: pnpm --filter @dante/web test

const ESC = String.fromCharCode(27);
const sgr = (codes: string) => `${ESC}[${codes}m`;

/** 글자마다 "글자|글자색|배경색|꾸밈" 으로 펼친다. 터미널이 그리는 모양과 같은 정보다. */
function styled(texts: string[], withDecorations: boolean): string[] {
  const parts = texts.flatMap((text) => Anser.ansiToJson(text, { remove_empty: true }));
  return parts.flatMap((part) =>
    [...part.content].map(
      (char) => `${char}|${part.fg}|${part.bg}|${withDecorations ? part.decorations.join(",") : ""}`
    )
  );
}

const joined = (log: StepLog) => log.chunks.map((chunk) => chunk.text).join("");

/** vitest 비슷한 출력: 줄 안에서 닫는 색, 줄을 넘는 색, 0 리셋, 줄 지우기(ESC[K), 굵게·흐리게. */
function sampleLog(lines: number): string {
  let out = "";
  for (let i = 0; i < lines; i += 1) {
    if (i % 7 === 0) out += `${sgr("1")}${sgr("31")} FAIL ${sgr("39")}${sgr("22")} case ${i}\n`;
    else if (i % 11 === 0) out += `${sgr("33")}warning spans\nnext line ${i}${sgr("0")}\n`;
    else if (i % 13 === 0) out += `${sgr("32")}progress ${i}${ESC}[K\n${sgr("39")}`;
    else if (i % 5 === 0) out += `${sgr("2")}dim ${i}${sgr("22")} ${sgr("36")}cyan${sgr("39")}\n`;
    else out += `  ✓ test number ${i} passed in ${i % 17}ms\n`;
  }
  return out;
}

/** 여러 크기로 쪼개 붙인다(스트림 조각이 줄 중간에서 끊겨 온다). */
function feed(text: string, max: number, seed: number): StepLog[] {
  const logs: StepLog[] = [];
  let log = EMPTY_LOG;
  let at = 0;
  let size = seed;
  while (at < text.length) {
    size = (size * 7919 + 13) % 997;
    const piece = text.slice(at, at + 1 + size);
    at += piece.length;
    log = appendLog(log, piece, max);
    logs.push(log);
  }
  return logs;
}

describe("appendLog", () => {
  it("keeps the same text as the concatenated and trimmed string", () => {
    const text = sampleLog(3000);
    for (const max of [Infinity, 100_000, 20_000]) {
      const logs = feed(text, max, 3);
      const last = logs.at(-1)!;
      const expected = text.length > max ? text.slice(-max) : text;
      assert.equal(joined(last), expected);
      assert.equal(last.length, expected.length);
      assert.ok(last.chunks.length > 1, "long output should be split into chunks");
    }
  });

  it("colors every character the same as parsing the whole text", () => {
    const text = sampleLog(2000);
    for (const max of [Infinity, 30_000]) {
      const logs = feed(text, max, 5);
      // 글자색·배경색은 매 순간 같아야 한다.
      for (const log of logs.filter((_, i) => i % 25 === 0)) {
        assert.deepEqual(
          styled(
            log.chunks.map((chunk) => chunk.text),
            false
          ),
          styled([joined(log)], false)
        );
      }
      // 꾸밈(굵게 등)은 anser 가 배열을 공유해 뒤 명령이 앞 글자에도 번진다. 출력이 다 온 뒤엔 같아야 한다.
      const last = logs.at(-1)!;
      assert.deepEqual(
        styled(
          last.chunks.map((chunk) => chunk.text),
          true
        ),
        styled([joined(last)], true)
      );
    }
  });

  it("keeps chunk ids stable so sealed chunks are not re-rendered", () => {
    const text = sampleLog(1500);
    const logs = feed(text, Infinity, 7);
    const sealed = new Map<number, string>();
    for (const log of logs) {
      for (const chunk of log.chunks.slice(0, -1)) {
        const before = sealed.get(chunk.id);
        if (before !== undefined) assert.equal(chunk.text, before);
        sealed.set(chunk.id, chunk.text);
      }
    }
  });

  it("does not split while a color runs across lines", () => {
    const red = `${sgr("31")}${"red line\n".repeat(1000)}${sgr("39")}done\n`;
    const log = logFromText(red);
    assert.equal(log.chunks.filter((chunk) => chunk.text).length, 1);
  });
});
