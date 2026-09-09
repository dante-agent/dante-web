import { redirect } from "next/navigation";

// /project/<ref>/settings 자체에는 내용이 없다. 첫 항목으로 보낸다.
// 왼쪽 아이콘 레일의 Settings 가 이 주소를 가리키므로 이 자리는 남겨둔다.
export default async function ProjectSettingsIndex({
  params,
}: PageProps<"/project/[projectRef]/settings">) {
  const { projectRef } = await params;
  redirect(`/project/${projectRef}/settings/general`);
}
