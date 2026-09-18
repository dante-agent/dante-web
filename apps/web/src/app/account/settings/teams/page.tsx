import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@dante/db";
import { switchTeam } from "@/app/team/actions";
import { CreateTeamForm } from "@/components/settings/team/create-team-form";
import { SettingsHeader } from "@/components/settings/settings-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentTeamId } from "@/lib/teams/current";
import { TEAM_NAME_MAX } from "@/lib/teams/manage";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Teams" };

// 계정 설정 Teams. 내가 속한 팀 목록 + 새 팀 만들기.
//
// 팀마다의 설정(이름·멤버·삭제)은 여기로 끌어오지 않고 /team/<id>/settings 로 보낸다.
// 계정 설정은 "나 한 사람"의 값이고, 팀 설정은 팀원 모두가 보는 값이다.
export default async function AccountTeamsPage() {
  const user = await requireUser();
  const currentTeamId = await getCurrentTeamId(user);

  const memberships = await prisma.teamMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          personalForUserId: true,
          _count: { select: { members: true, projects: true } },
        },
      },
    },
  });

  return (
    <>
      <SettingsHeader
        title="Teams"
        description="Projects and GitHub connections belong to a team. The team selected in the header decides which projects you see and where new connections go."
      />

      <ul className="border-border divide-border bg-card mt-8 max-w-2xl divide-y border">
        {memberships.map(({ role, team }) => {
          const current = team.id === currentTeamId;
          return (
            <li key={team.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {team.name}
                  {current && <span className="text-muted-foreground font-normal"> (current)</span>}
                </p>
                <p className="text-muted-foreground font-mono text-[11px]">
                  {team.personalForUserId ? "Personal" : "Shared"} · {role} ·{" "}
                  {plural(team._count.members, "member")} ·{" "}
                  {plural(team._count.projects, "project")}
                </p>
              </div>

              {!current && (
                // 인자를 묶은 서버 액션. 폼이 FormData 를 뒤에 붙여 넘기지만 switchTeam 은 쓰지 않는다.
                <form action={switchTeam.bind(null, team.id, "/projects")}>
                  <Button type="submit" variant="ghost" size="sm" className="rounded-[4px]">
                    Switch
                  </Button>
                </form>
              )}
              <Link
                href={`/team/${team.id}/settings/general`}
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "rounded-[4px]",
                })}
              >
                Settings
              </Link>
            </li>
          );
        })}
      </ul>

      <CreateTeamForm maxLength={TEAM_NAME_MAX} />
    </>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
