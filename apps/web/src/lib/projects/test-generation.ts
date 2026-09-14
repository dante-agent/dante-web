import type { TestRecommendation } from "./recommendations";

const CODE_FENCE_RE = /^```(?:\w+)?\s*\n([\s\S]*?)\n```\s*$/;

export function findSourceFromPrompt(
  prompt: string,
  recommendations: TestRecommendation[]
): TestRecommendation | null {
  const query = prompt.trim().toLocaleLowerCase();
  if (!query) return null;

  const matches = recommendations
    .map((recommendation) => {
      const path = recommendation.filePath.toLocaleLowerCase();
      const name = recommendation.componentName.toLocaleLowerCase();
      let score = 0;

      if (query.includes(path)) score += 100;
      if (name.length >= 3 && query.includes(name)) score += 50;

      const pathTerms = path.split(/[/._-]+/).filter((term) => term.length >= 3);
      score += pathTerms.filter((term) => query.includes(term)).length;

      return { recommendation, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.recommendation.filePath.localeCompare(b.recommendation.filePath)
    );

  if (matches.length === 0 || matches[0]?.score === matches[1]?.score) return null;
  return matches[0].recommendation;
}

export function testPathFor(sourcePath: string): string {
  const extension = sourcePath.match(/\.[^./]+$/)?.[0] ?? ".ts";
  return `${sourcePath.slice(0, -extension.length)}.test${extension}`;
}

export function cleanGeneratedCode(value: string): string {
  const trimmed = value.trim();
  return (trimmed.match(CODE_FENCE_RE)?.[1] ?? trimmed).trim() + "\n";
}
