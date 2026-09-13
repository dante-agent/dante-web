// 세션 상세(Jules 세션 화면) 스캐폴드용 목업. 실제 생성·저장 붙이면 이 파일은 삭제.
// 데이터 흐름: 추천 클릭 → 세션 생성(AI) → 이 화면. 지금은 정적 목업으로 레이아웃만 잡는다.

export type DiffLineKind = "add" | "del" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  /** 원본(old) 줄번호. 추가 줄이면 null. */
  oldNo: number | null;
  /** 신규(new) 줄번호. 삭제 줄이면 null. */
  newNo: number | null;
  text: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  readOnly: boolean;
  /** 대상 파일(레포 루트 기준). */
  targetFile: string;
  branch: string;
  /** 소요 시간 표시용(예: "15 mins"). */
  timeSpent: string;
  summary: {
    what: string[];
    why: string[];
    verification: string[];
  };
  code: {
    /** "M"(수정) | "A"(추가) — 파일 상태 배지. */
    changeType: "M" | "A";
    path: string;
    additions: number;
    deletions: number;
    lines: DiffLine[];
  };
}

export const sessionDetailMock: SessionDetail = {
  id: "s-1",
  title: "Generate formatDateKoreanYMD test file",
  readOnly: true,
  targetFile: "src/shared/lib/formatDateKoreanYMD.ts",
  branch: "test/format-date-korean-ymd-8288460042810619024",
  timeSpent: "15 mins",
  summary: {
    what: [
      "Created a new Vitest test file for `formatDateKoreanYMD`.",
      "Verifies valid dates, invalid dates, and boundary (month/day digit) cases.",
      "Snapshots the result of applying `timeZone: 'Asia/Seoul'` with `Intl.DateTimeFormat`.",
    ],
    why: [
      "Date formatting logic is sensitive to timezone and locale and regresses easily, but had no tests.",
      "Locks in the contract of returning `Invalid Date` for invalid input.",
    ],
    verification: ["Confirmed all 6 cases pass with `pnpm vitest run formatDateKoreanYMD`."],
  },
  code: {
    changeType: "A",
    path: "src/shared/lib/formatDateKoreanYMD.test.ts",
    additions: 19,
    deletions: 0,
    lines: [
      {
        kind: "add",
        oldNo: null,
        newNo: 1,
        text: 'import { describe, it, expect } from "vitest";',
      },
      {
        kind: "add",
        oldNo: null,
        newNo: 2,
        text: 'import { formatDateKoreanYMD } from "./formatDateKoreanYMD";',
      },
      { kind: "add", oldNo: null, newNo: 3, text: "" },
      { kind: "add", oldNo: null, newNo: 4, text: 'describe("formatDateKoreanYMD", () => {' },
      {
        kind: "add",
        oldNo: null,
        newNo: 5,
        text: '  it("converts a valid ISO date to YYYY. MM. DD.", () => {',
      },
      {
        kind: "add",
        oldNo: null,
        newNo: 6,
        text: '    expect(formatDateKoreanYMD("2026-09-12")).toBe("2026. 09. 12.");',
      },
      { kind: "add", oldNo: null, newNo: 7, text: "  });" },
      { kind: "add", oldNo: null, newNo: 8, text: "" },
      {
        kind: "add",
        oldNo: null,
        newNo: 9,
        text: '  it("pads single-digit month/day to two digits", () => {',
      },
      {
        kind: "add",
        oldNo: null,
        newNo: 10,
        text: '    expect(formatDateKoreanYMD("2026-01-02")).toBe("2026. 01. 02.");',
      },
      { kind: "add", oldNo: null, newNo: 11, text: "  });" },
      { kind: "add", oldNo: null, newNo: 12, text: "" },
      {
        kind: "add",
        oldNo: null,
        newNo: 13,
        text: '  it("returns Invalid Date for an invalid date", () => {',
      },
      {
        kind: "add",
        oldNo: null,
        newNo: 14,
        text: '    expect(formatDateKoreanYMD("not-a-date")).toBe("Invalid Date");',
      },
      { kind: "add", oldNo: null, newNo: 15, text: "  });" },
      { kind: "add", oldNo: null, newNo: 16, text: "" },
      {
        kind: "add",
        oldNo: null,
        newNo: 17,
        text: '  it("handles the midnight boundary in Asia/Seoul", () => {',
      },
      {
        kind: "add",
        oldNo: null,
        newNo: 18,
        text: '    expect(formatDateKoreanYMD("2026-12-31T15:00:00Z")).toBe("2027. 01. 01.");',
      },
      { kind: "add", oldNo: null, newNo: 19, text: "  });" },
    ],
  },
};
