// 테스트가 없는 소스 파일을 "테스트를 만들면 좋은 후보"로 추천한다 (서버 전용).
//
// 폴더 보기와 같은 소스인 getRepoTree(레포 파일 트리)에서 status:"none"(대응 테스트 파일이
// 없는 소스)만 남기고, 파일마다 점수를 매겨 높은 순으로 자른다(recommendation-score.ts).
// 점수에는 코드에서 뽑은 신호(분기·피참조 수·줄 수, code-signals.ts)가 들어간다. 코드를
// 못 읽었으면 경로·파일 크기만으로 매긴다.
//
// 자르기(MAX)는 반드시 점수를 매긴 뒤에 한다 — 먼저 자르면 중요한 파일이 이름 순에서 밀려
// 아예 후보에 못 든다.

import { getRepoTree, getRepoTreeMeta } from "@/lib/github/tree";
import { getCodeSignals } from "@/lib/projects/code-signals";
import type { ProjectRepo } from "@/lib/projects/queries";
import { scoreFile, type RecommendationPriority } from "@/lib/projects/recommendation-score";
import { isTestTarget } from "@/lib/projects/test-targets";

export type { RecommendationPriority };

export interface TestRecommendation {
  /** 안정적인 키 = 소스 파일 경로 (한 파일당 추천 하나). */
  id: string;
  componentName: string;
  filePath: string;
  /** 왜 이 파일을 추천하는지 — 점수에 가장 크게 기여한 신호. */
  reason: string;
  priority: RecommendationPriority;
  /** 0~1. 높을수록 먼저 테스트할 파일. 정렬 기준. */
  score: number;
  /** 구조상 테스트할 로직이 거의 없어 점수를 깎은 파일(배럴·타입 전용·스토리·단순 UI). */
  deprioritized: boolean;
}

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

/** 테스트가 없는 소스 파일을 점수(높음→낮음) 순으로. */
export async function getTestRecommendations(repo: ProjectRepo): Promise<TestRecommendation[]> {
  const [entries, meta, code] = await Promise.all([
    getRepoTree(repo),
    getRepoTreeMeta(repo),
    getCodeSignals(repo),
  ]);
  return (
    entries
      // 설정·테스트 준비 파일은 테스트를 만들 대상이 아니다(test-targets.ts).
      .filter((entry) => entry.status === "none" && isTestTarget(entry.path))
      .map((entry) => ({
        id: entry.path,
        componentName: componentName(entry.path),
        filePath: entry.path,
        ...scoreFile(entry.path, { size: meta.sizes.get(entry.path), code: code?.[entry.path] }),
      }))
      .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
      .slice(0, MAX)
  );
}
