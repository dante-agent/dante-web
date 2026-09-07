// 프로젝트 스코프 셸. /project/<ref>/... 로 시작하는 모든 페이지가 이 레이아웃을 공유한다.
// 페이지를 오가도 이 컴포넌트는 다시 렌더되지 않으므로 사이드바·헤더가 들어갈 자리다.
//
// TODO(다음 PR): params.projectRef 로 프로젝트를 조회해서
//   - 없거나 멤버가 아니면 notFound()  ← 권한 검사는 앱 코드에서 (AGENTS.md)
//   - 사이드바(대시보드 / 폴더 / 추천 / 설정) 렌더
export default function ProjectLayout({ children }: LayoutProps<"/project/[projectRef]">) {
  return <div className="min-h-svh">{children}</div>;
}
