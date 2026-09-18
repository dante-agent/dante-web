// 프로젝트 스코프 셸. /project/<ref>/... 로 시작하는 모든 페이지가 이 레이아웃을 공유한다.
// 페이지를 오가도 이 컴포넌트는 다시 렌더되지 않으므로 사이드바·헤더가 들어갈 자리다.
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ProjectSidebar } from "@/components/project-sidebar";
import { avatarUrl, displayName } from "@/lib/auth/user";
import { requireProjectContext } from "@/lib/projects/queries";

// 탭 제목: "Dashboard · my-repo · Dante". 프로젝트를 여러 탭에 띄워도 구분되게 이름을 넣는다.
// default 에는 " · Dante" 를 붙이지 않는다. 하위에서 notFound() 가 나면 Next 가 default 에 루트
// 템플릿을 한 번 더 씌워 "my-repo · Dante · Dante" 가 된다.
// requireProjectContext 는 cache 라 아래 레이아웃과 같은 요청에서 한 번만 읽는다.
export async function generateMetadata({
  params,
}: LayoutProps<"/project/[projectRef]">): Promise<Metadata> {
  const { projectRef } = await params;
  const { project } = await requireProjectContext(projectRef);
  return {
    title: { default: project.name, template: `%s · ${project.name} · Dante` },
  };
}

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]">) {
  const { projectRef } = await params;
  const { user, project, projects, teams } = await requireProjectContext(projectRef);

  // 프로필 이미지·이름은 로그인 세션(Supabase)에서 바로 꺼낸다 — public.users 미러는
  // 로그인 시점에만 갱신되므로 세션 쪽이 항상 최신이다.
  const headerUser = { name: displayName(user), avatarUrl: avatarUrl(user) };

  // <main> 은 여기 한 곳에만 둔다. 페이지마다 반복하지 않는다.
  // 메인 사이드바는 fixed(콘텐츠 위로 덮음)라 <main> 은 접힌 폭만큼 ml-14 로 비켜둔다.
  // 여백은 섹션이 각자 준다 — 폴더 보기는 에디터를 화면 끝까지 채워야 해서 0 이다.
  return (
    <div className="min-h-svh pt-[47px]">
      <AppHeader project={project} projects={projects} teams={teams} user={headerUser} />
      <ProjectSidebar />
      <main className="ml-14">{children}</main>
    </div>
  );
}
