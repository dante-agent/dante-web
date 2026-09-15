import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripAnsi } from "./live.ts";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe("stripAnsi", () => {
  it("removes vitest color codes and keeps the text", () => {
    const raw = `${ESC}[32m✓${ESC}[39m src/a.test.ts ${ESC}[2m(3 tests)${ESC}[22m\n${ESC}[1m${ESC}[31mFAIL${ESC}[39m${ESC}[22m b`;
    assert.equal(stripAnsi(raw), "✓ src/a.test.ts (3 tests)\nFAIL b");
  });

  it("removes cursor moves and OSC hyperlinks", () => {
    assert.equal(stripAnsi(`a${ESC}[2K${ESC}[1Gb${ESC}]8;;http://x${BEL}c`), "abc");
  });

  it("leaves text without escapes alone", () => {
    assert.equal(stripAnsi("no codes [1m here"), "no codes [1m here");
  });
});
