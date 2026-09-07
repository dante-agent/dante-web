import { redirect } from "next/navigation";

// /project/<ref> 자체에는 화면이 없다. 프로젝트의 첫 화면인 대시보드로 넘긴다.
// (Supabase 대시보드가 /dashboard/project/<ref> 를 처리하는 방식과 같다)
export default async function ProjectIndexPage({ params }: PageProps<"/project/[projectRef]">) {
  const { projectRef } = await params;
  redirect(`/project/${projectRef}/dashboard`);
}
