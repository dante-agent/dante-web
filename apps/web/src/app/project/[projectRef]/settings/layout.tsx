import Link from "next/link";
import { SettingsShell } from "@/components/settings/settings-shell";
import { requireProjectContext } from "@/lib/projects/queries";

// 프로젝트 설정 셸.
//
// 여기 있는 값은 전부 "이 레포 하나"에 붙는다. 프로젝트를 옮기면 값도 달라진다.
// 계정에 붙는 것(AI 키·익스텐션 페어링)은 /account/settings 로 갈라 뒀고,
// 찾는 사람이 헤매지 않게 왼쪽 열 아래에 건너가는 링크를 남긴다.
const items = (ref: string) => [
  { href: `/project/${ref}/settings/general`, label: "General" },
  { href: `/project/${ref}/settings/github`, label: "GitHub" },
  { href: `/project/${ref}/settings/runtime`, label: "Runtime" },
  { href: `/project/${ref}/settings/notifications`, label: "Notifications" },
];

export default async function ProjectSettingsLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]/settings">) {
  const { projectRef } = await params;

  // 권한 검사는 앱 코드에서 (AGENTS.md). 바깥 프로젝트 레이아웃이 같은 요청에서 이미
  // 읽은 결과를 그대로 받는다 — 멤버가 아니면 거기서 notFound() 가 난다.
  const { project } = await requireProjectContext(projectRef);

  return (
    <div className="p-8">
      <SettingsShell
        title="Project"
        scope={project.name}
        items={items(projectRef)}
        footer={
          <Link
            href="/account/settings/ai"
            className="text-muted-foreground hover:text-foreground block text-[13px] leading-relaxed transition-colors duration-[180ms] ease-out"
          >
            AI and the editor extension are
            <span className="underline underline-offset-4"> account settings</span> — one setting
            for every project.
          </Link>
        }
      >
        {children}
      </SettingsShell>
    </div>
  );
}
