// 테스트가 없는 소스 파일을 "테스트를 만들면 좋은 후보"로 추천한다 (서버 전용).
//
// 아직 컴포넌트 추출(ts-morph)이 없어 Component/TestFile 테이블이 비어 있으므로,
// 폴더 보기와 같은 소스인 getRepoTree(레포 파일 트리)를 그대로 재사용한다.
// status:"none"(대응 테스트 파일이 없는 소스)만 남기고 경로로 우선순위를 매긴다.
//
// 우선순위는 "무엇을 먼저 테스트해야 하나"의 휴리스틱일 뿐이다 — 코드를 읽고
// 판단하는 게 아니라 경로 이름만 본다. AI 로 실제 코드를 읽어 매기는 건 다음 단계.

import { getRepoTree } from "@/lib/github/tree";
import type { ProjectRepo } from "@/lib/projects/queries";

export type RecommendationPriority = "high" | "medium" | "low";

export interface TestRecommendation {
  /** 안정적인 키 = 소스 파일 경로 (한 파일당 추천 하나). */
  id: string;
  componentName: string;
  filePath: string;
  /** 왜 이 파일을 추천하는지 — 경로 휴리스틱이 매긴 사유. */
  reason: string;
  priority: RecommendationPriority;
}

// 틀리면 크게 다치는 도메인. 경로 어디든 걸리면 "높음".
const HIGH_RE =
  /(auth|login|logout|password|token|session|payment|checkout|order|billing|refund|security|permission)/i;
// 대체로 단순한 표현용 UI. "낮음".
const LOW_RE = /(\/ui\/|icon|tooltip|badge|avatar|spinner|skeleton|divider|separator)/i;

function classify(path: string): Pick<TestRecommendation, "priority" | "reason"> {
  if (HIGH_RE.test(path)) {
    return {
      priority: "high",
      reason: "Looks like core logic (auth, payments, etc.) but has no test file",
    };
  }
  if (LOW_RE.test(path)) {
    return { priority: "low", reason: "Simple UI component — low test priority" };
  }
  return { priority: "medium", reason: "No test file yet" };
}

const PRIORITY_ORDER: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * 경로 끝 파일명에서 확장자를 뗀 것. 예: "src/checkout/CheckoutForm.tsx" → "CheckoutForm"
 * 폴더 보기 생성도 이 값을 쓴다 — 저장 키(Component.exportName)가 같아야 버전이 한 줄로 이어진다.
 */
export function componentName(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[^./]+$/, "");
}

/** 상한. 한 화면에 다 못 보여주고, 큰 레포에서 수백 개가 쏟아지는 걸 막는다. */
const MAX = 30;

/** 테스트가 없는 소스 파일을 우선순위(높음→낮음) 순으로. */
export async function getTestRecommendations(repo: ProjectRepo): Promise<TestRecommendation[]> {
  const entries = await getRepoTree(repo);
  return entries
    .filter((entry) => entry.status === "none")
    .map((entry) => ({
      id: entry.path,
      componentName: componentName(entry.path),
      filePath: entry.path,
      ...classify(entry.path),
    }))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.filePath.localeCompare(b.filePath)
    )
    .slice(0, MAX);
}
