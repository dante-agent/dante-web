import { SubSidebar } from "@/components/sub-sidebar";
import { SessionNavList } from "./_components/session-nav-list";
import { recommendMock } from "./mock-data";

// AI 추천 섹션 셸. 서브 사이드바에 최근 세션 목록을 보여준다.
export default async function RecommendLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]/recommend">) {
  const { projectRef } = await params;
  return (
    <SubSidebar nav={<SessionNavList projectRef={projectRef} sessions={recommendMock.sessions} />}>
      {children}
    </SubSidebar>
  );
}
