// 프로젝트 스코프 셸. /project/<ref>/... 로 시작하는 모든 페이지가 이 레이아웃을 공유한다.
// 페이지를 오가도 이 컴포넌트는 다시 렌더되지 않으므로 사이드바·헤더가 들어갈 자리다.
//
// TODO(다음 PR): params.projectRef 로 프로젝트를 조회해서
//   - 없거나 멤버가 아니면 notFound()  ← 권한 검사는 앱 코드에서 (AGENTS.md)
import { ProjectSidebar } from "@/components/project-sidebar";

export default function ProjectLayout({ children }: LayoutProps<"/project/[projectRef]">) {
  // <main> 은 여기 한 곳에만 둔다. 페이지마다 반복하지 않는다.
  // 메인 사이드바는 fixed(콘텐츠 위로 덮음)라 <main> 은 접힌 폭만큼 ml-14 로 비켜둔다.
  return (
    <div className="min-h-svh pt-12">
      {/* 최상단 헤더 — 임시 빈 영역 */}
      <header className="bg-sidebar border-sidebar-border fixed inset-x-0 top-0 z-40 h-12 border-b" />
      <ProjectSidebar />
      <main className="ml-14 p-8">{children}</main>
    </div>
  );
}
