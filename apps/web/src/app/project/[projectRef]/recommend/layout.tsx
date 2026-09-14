import { SubSidebar } from "@/components/sub-sidebar";
import { getGeneratedSessions } from "@/lib/projects/generated-sessions";
import { requireProjectContext } from "@/lib/projects/queries";
import { SessionNavList } from "./_components/session-nav-list";

// AI 추천 섹션 셸. 서브 사이드바에 최근 세션(저장된 테스트 버전) 목록을 보여준다.
export default async function RecommendLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]/recommend">) {
  const { projectRef } = await params;
  const { user } = await requireProjectContext(projectRef);
  const sessions = await getGeneratedSessions(projectRef, user.id);
  return (
    <SubSidebar nav={<SessionNavList projectRef={projectRef} sessions={sessions} />}>
      {children}
    </SubSidebar>
  );
}
