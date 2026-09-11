import { SubSidebar } from "@/components/sub-sidebar";
import { SessionNavList } from "./_components/session-nav-list";
import { recommendMock } from "./mock-data";

// AI 추천 섹션 셸. 서브 사이드바에 최근 세션 목록을 보여준다.
export default function RecommendLayout({
  children,
}: LayoutProps<"/project/[projectRef]/recommend">) {
  return (
    <SubSidebar nav={<SessionNavList sessions={recommendMock.sessions} />}>{children}</SubSidebar>
  );
}
