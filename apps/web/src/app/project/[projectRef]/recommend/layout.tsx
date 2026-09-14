import { SubSidebar } from "@/components/sub-sidebar";
import { requireUser } from "@/lib/auth/user";
import { getGeneratedSessions } from "@/lib/projects/generation-sessions";
import { SessionNavList } from "./_components/session-nav-list";

// AI 추천 섹션 셸. 서브 사이드바에 최근 세션 목록을 보여준다.
export default async function RecommendLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]/recommend">) {
  const { projectRef } = await params;
  const user = await requireUser();
  const sessions = await getGeneratedSessions(projectRef, user.id);
  return (
    <SubSidebar nav={<SessionNavList projectRef={projectRef} sessions={sessions} />}>
      {children}
    </SubSidebar>
  );
}
