import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { MemberControls } from "@/components/settings/team/team-forms";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { UserAvatar } from "@/components/user-avatar";
import { requireTeamMember } from "@/lib/teams/access";

// 팀 멤버. 목록 + 역할 바꾸기·내보내기·나가기. 규칙은 lib/teams/manage.ts.
export default async function TeamMembersPage({
  params,
}: PageProps<"/team/[teamId]/settings/members">) {
  const { teamId } = await params;

  const { user, role } = await requireTeamMember(teamId);
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      personalForUserId: true,
      members: {
        // enum 순서(owner → member)대로, 같은 역할 안에서는 먼저 들어온 순.
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          role: true,
          user: { select: { id: true, githubLogin: true, email: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!team) notFound();

  const viewerIsOwner = role === "owner";
  const owners = team.members.filter((member) => member.role === "owner").length;

  return (
    <>
      <SettingsHeader
        title="Members"
        description="Everyone on the team can open and configure its projects. Owners can also delete projects, manage members and delete the team."
      />

      <ul className="border-border divide-border bg-card mt-8 max-w-2xl divide-y border">
        {team.members.map(({ role: memberRole, user: member }) => {
          // lib/auth/user.ts 의 displayName 과 같은 순서. 세션이 없는 남의 행이라 DB 값만 쓴다.
          const name = member.githubLogin ?? member.email?.split("@")[0] ?? "User";
          const isSelf = member.id === user.id;
          const personalOwner = team.personalForUserId === member.id;

          return (
            <li key={member.id} className="flex items-center gap-3 px-5 py-3">
              <UserAvatar src={member.avatarUrl} name={name} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {name}
                  {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                </p>
                {member.email && (
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {member.email}
                  </p>
                )}
              </div>

              <span className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
                {memberRole}
              </span>

              <MemberControls
                teamId={teamId}
                userId={member.id}
                role={memberRole}
                isSelf={isSelf}
                canManage={viewerIsOwner && !personalOwner}
                canLeave={isSelf && !personalOwner && !(memberRole === "owner" && owners === 1)}
              />
            </li>
          );
        })}
      </ul>

      <ComingSoon>
        Inviting people by email — it lands next. Until then a team has only the people already on
        it.
      </ComingSoon>
    </>
  );
}
