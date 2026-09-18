import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTextFiles } from "./tar.ts";

// 실행: pnpm --filter @dante/web test

/** 테스트용 최소 tar 헤더 한 블록 + 데이터. */
function entry(name: string, body: string, type = "0"): Buffer {
  const data = Buffer.from(body, "utf8");
  const header = Buffer.alloc(512);
  header.write(name.slice(0, 100), 0, "utf8");
  header.write(data.length.toString(8).padStart(11, "0") + "\0", 124, "utf8");
  header.write(type, 156, "utf8");
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(padded);
  return Buffer.concat([header, padded]);
}

function pax(path: string): Buffer {
  const record = (len: number) => `${len} path=${path}\n`;
  let len = record(0).length;
  while (record(len).length !== len) len = record(len).length;
  return entry("pax", record(len), "x");
}

const END = Buffer.alloc(1024);

describe("extractTextFiles", () => {
  it("루트 폴더를 떼고 원하는 파일만 꺼낸다", () => {
    const tar = Buffer.concat([
      entry("pax_global_header", "52 comment=abc\n", "g"),
      entry("owner-repo-abc/", "", "5"),
      entry("owner-repo-abc/src/a.ts", "export const a = 1;"),
      entry("owner-repo-abc/logo.png", "binary"),
      END,
    ]);
    const files = extractTextFiles(tar, (p) => p.endsWith(".ts"));
    assert.deepEqual([...files], [["src/a.ts", "export const a = 1;"]]);
  });

  it("pax 헤더의 긴 경로를 쓴다", () => {
    const long = `owner-repo-abc/${"deep/".repeat(30)}file.ts`;
    const tar = Buffer.concat([pax(long), entry(long.slice(0, 100), "x"), END]);
    const files = extractTextFiles(tar, () => true);
    assert.deepEqual([...files.keys()], [`${"deep/".repeat(30)}file.ts`]);
  });

  it("잘린 아카이브는 읽은 데까지만 돌려준다", () => {
    const whole = Buffer.concat([entry("r/a.ts", "a"), entry("r/b.ts", "b".repeat(600))]);
    const files = extractTextFiles(whole.subarray(0, whole.length - 700), () => true);
    assert.deepEqual([...files.keys()], ["a.ts"]);
  });
});
