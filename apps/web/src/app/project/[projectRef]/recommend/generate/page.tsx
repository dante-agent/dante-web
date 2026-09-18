import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProjectContext } from "@/lib/projects/queries";
import { GeneratePerformance } from "./_components/generate-performance";

export const metadata: Metadata = { title: "Generating tests" };

// 한 번에 만들 수 있는 최대 파일 수(서버 MAX_MATCHES 와 맞춘다).
const MAX_FILES = 3;

/**
 * 추천 카드·"Generate N selected" 를 누르면 바로 여기로 온다. 아직 저장된 버전이 없어 세션 id 가
 * 없으므로 대상 파일을 ?file= 로 받는다. 좌측은 파일을 AI 로 보내는 연출, 우측은 테스트 코드가
 * 써지는 연출을 보여주고, 끝나면 실제 세션(/recommend/[session])으로 넘어간다.
 *
 * 경로는 믿지 않는다 — 생성 액션(generatePlannedTests)이 현재 후보에 있는 것만 거른다.
 */
export default async function GenerateTestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectRef: string }>;
  searchParams: Promise<{ file?: string | string[] }>;
}) {
  const { projectRef } = await params;
  const { file } = await searchParams;
  const files = [...new Set([file ?? []].flat().map((f) => f.trim()))]
    .filter(Boolean)
    .slice(0, MAX_FILES);
  if (files.length === 0) redirect(`/project/${projectRef}/recommend`);

  const { project } = await requireProjectContext(projectRef);

  return <GeneratePerformance projectRef={projectRef} projectName={project.name} files={files} />;
}
