import { ReviewPanel } from "./_components/review-panel";
import { requireProjectContext } from "@/lib/projects/queries";
import { sessionDetailMock } from "./mock-data";

// AI 추천 세션 상세 (Jules 세션 화면). 좌측 세션 사이드바는 recommend/layout.tsx 가 제공하고,
// 여기서는 중앙 리뷰 패널을 채운다.
// 지금은 정적 목업 — 실제 생성/저장이 붙으면 session 파라미터로 조회한다.
export default async function SessionDetailPage({
  params,
}: PageProps<"/project/[projectRef]/recommend/[session]">) {
  const { projectRef } = await params;
  const { project } = await requireProjectContext(projectRef);
  const session = sessionDetailMock;

  return (
    <div className="-m-8 flex h-[calc(100svh-47px)] min-h-0">
      <ReviewPanel projectName={project.name} projectRef={projectRef} session={session} />
    </div>
  );
}
