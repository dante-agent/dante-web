import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { InviteForm, RevokeInviteButton } from "@/components/settings/team/invite-forms";
import { MemberControls } from "@/components/settings/team/team-forms";
import { SettingsHeader } from "@/components/settings/settings-section";
import { UserAvatar } from "@/components/user-avatar";
import { requireTeamMember } from "@/lib/teams/access";

export const metadata: Metadata = { title: "Members" };

// 팀 멤버. 목록 + 역할 바꾸기·내보내기·나가기 + 초대. 규칙은 lib/teams/manage.ts·invites.ts.
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
      // 만료된 초대는 보여주지 않는다. 행은 다음 초대를 보낼 때 치운다(invites.ts).
      invites: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, expiresAt: true },
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
              {/* 옆에 이름이 바로 있어 사진의 alt(이름)가 두 번 읽힌다. 이 자리에서는 숨긴다. */}
              <span aria-hidden="true" className="contents">
                <UserAvatar src={member.avatarUrl} name={name} />
              </span>

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
                name={name}
                role={memberRole}
                isSelf={isSelf}
                canManage={viewerIsOwner && !personalOwner}
                canChangeRole={
                  viewerIsOwner && !personalOwner && !(memberRole === "owner" && owners === 1)
                }
                canLeave={isSelf && !personalOwner && !(memberRole === "owner" && owners === 1)}
              />
            </li>
          );
        })}
      </ul>

      {viewerIsOwner && <InviteForm teamId={teamId} />}

      {team.invites.length > 0 && (
        <section className="mt-8 max-w-2xl">
          <h2 className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
            Open invites
          </h2>
          <ul className="border-border divide-border bg-card mt-3 divide-y border">
            {team.invites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]">{invite.email}</p>
                  <p className="text-muted-foreground text-[11px]">
                    Expires {EXPIRY_FORMAT.format(invite.expiresAt)}
                  </p>
                </div>
                {viewerIsOwner && (
                  <RevokeInviteButton teamId={teamId} inviteId={invite.id} email={invite.email} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// 서버에서 그리므로 시간대를 못박는다. 날짜만 보여줘서 하루 안쪽의 어긋남은 드러나지 않는다.
const EXPIRY_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
