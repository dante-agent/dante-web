import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import danteLogo from "@/assets/dante-logo.png";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { FeedbackLink } from "@/components/feedback-link";
import { SettingsShell } from "@/components/settings/settings-shell";
import { TeamSwitcher } from "@/components/team-switcher";
import { UserMenu } from "@/components/user-menu";
import { avatarUrl, displayName } from "@/lib/auth/user";
import { requireTeamMember } from "@/lib/teams/access";
import { listTeams } from "@/lib/teams/current";

// 팀 설정 셸. 헤더·레일·본문 여백은 계정 셸(account/layout.tsx)과 같게 맞춘다.
//
// URL 에 팀 id 를 넣는 이유: 다른 탭에서 보고 있는 팀을 바꿔도 이 화면의 버튼이
// 엉뚱한 팀에 적용되지 않는다. 멤버를 빼거나 팀을 지우는 화면이라 그 사고가 가장 크다.
export default async function TeamSettingsLayout({
  children,
  params,
}: LayoutProps<"/team/[teamId]/settings">) {
  const { teamId } = await params;

  // 멤버가 아니면 404. 페이지와 액션도 각자 다시 확인한다 (AGENTS.md).
  const { user } = await requireTeamMember(teamId);
  const [team, teams] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    listTeams(user.id),
  ]);
  if (!team) notFound();

  const headerUser = { name: displayName(user), avatarUrl: avatarUrl(user) };
  const items = [
    { href: `/team/${teamId}/settings/general`, label: "General" },
    { href: `/team/${teamId}/settings/members`, label: "Members" },
  ];

  return (
    <div className="min-h-svh pt-[47px]">
      <header className="bg-sidebar border-sidebar-border fixed inset-x-0 top-0 z-40 flex h-[47px] items-center border-b pr-3">
        <div className="flex h-full w-14 shrink-0 items-center pl-[18px]">
          <Link href="/projects" aria-label="Dante">
            <Image src={danteLogo} alt="" draggable={false} className="h-5 w-[15px] select-none" />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="text-muted-foreground/40 text-sm select-none">/</span>
          {/* 드롭다운의 값은 쿠키가 아니라 URL 의 팀이다. 고르면 그 팀의 설정으로 간다. */}
          <TeamSwitcher teams={teams} value={teamId} landing="settings" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <FeedbackLink />
          <UserMenu user={headerUser} />
        </div>
      </header>

      <AccountSidebar />
      <main className="ml-14 p-8">
        <SettingsShell title="Team" scope={team.name} items={items}>
          {children}
        </SettingsShell>
      </main>
    </div>
  );
}
