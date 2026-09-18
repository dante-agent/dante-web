// 세션 상세 화면(리뷰 패널 + 코드 패널)이 쓰는 뷰 타입.
// 데이터는 page.tsx 가 저장된 TestFileVersion 에서 만들어 넣는다.

export interface SessionDetail {
  id: string;
  title: string;
  readOnly: boolean;
  /** 대상 파일(레포 루트 기준). */
  targetFile: string;
  /** 화면에 한 줄로 보여줄 출처. 예: "Draft v3 · not committed". */
  origin: string;
  /** 생성 시각 표시용. 예: "3 minutes ago". */
  createdLabel: string;
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
  };
}
