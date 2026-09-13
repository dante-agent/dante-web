import { CodePanel } from "./_components/code-panel";
import { ResizableSplit } from "./_components/resizable-split";
import { ReviewPanel } from "./_components/review-panel";
import { requireProjectContext } from "@/lib/projects/queries";
import { sessionDetailMock } from "./mock-data";

// AI 추천 세션 상세 (Jules 세션 화면). 좌측 세션 사이드바는 recommend/layout.tsx 가 제공하고,
// 여기서는 중앙 리뷰 패널 + 우측 코드 diff 패널의 2-pane 을 채운다.
// 지금은 정적 목업 — 실제 생성/저장이 붙으면 session 파라미터로 조회한다.
export default async function SessionDetailPage({
  params,
}: PageProps<"/project/[projectRef]/recommend/[session]">) {
  const { projectRef } = await params;
  const { project } = await requireProjectContext(projectRef);
  const session = sessionDetailMock;

  // 프로젝트 셸의 p-8 을 상쇄해 Jules 처럼 패널을 화면 끝까지 붙인다. 헤더(47px) 아래를 꽉 채운다.
  // 두 패널 사이 구분선은 드래그로 폭 조절(ResizableSplit).
  return (
    <ResizableSplit
      left={<ReviewPanel projectName={project.name} projectRef={projectRef} session={session} />}
      right={<CodePanel code={session.code} />}
    />
  );
}
