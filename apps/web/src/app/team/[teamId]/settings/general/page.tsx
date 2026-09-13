import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { DeleteTeamForm, RenameTeamForm } from "@/components/settings/team/team-forms";
import { SettingsHeader } from "@/components/settings/settings-section";
import { requireTeamMember } from "@/lib/teams/access";
import { TEAM_NAME_MAX } from "@/lib/teams/manage";

// 팀 일반. 이름 + 요약 + 맨 아래 삭제. 무엇을 지우고 무엇을 남기는지는 manage.ts 주석에 있다.
export default async function TeamGeneralPage({
  params,
}: PageProps<"/team/[teamId]/settings/general">) {
  const { teamId } = await params;

  // 레이아웃에서 이미 확인했지만 페이지도 각자 확인한다 (AGENTS.md).
  const { role } = await requireTeamMember(teamId);
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      name: true,
      personalForUserId: true,
      _count: { select: { projects: true, members: true } },
    },
  });
  if (!team) notFound();

  const isOwner = role === "owner";
  const personal = team.personalForUserId !== null;

  return (
    <>
      <SettingsHeader
        title="General"
        description="A team owns its projects and GitHub connections. Everyone on the team works on the same projects."
      />

      <RenameTeamForm
        teamId={teamId}
        name={team.name}
        canEdit={isOwner}
        maxLength={TEAM_NAME_MAX}
      />

      <dl className="border-border divide-border bg-card mt-6 max-w-2xl divide-y border">
        <Field label="Type" value={personal ? "Personal" : "Shared"} />
        <Field label="Your role" value={role} />
        <Field label="Projects" value={String(team._count.projects)} />
        <Field label="Members" value={String(team._count.members)} />
      </dl>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-destructive/80 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
          Danger zone
        </h2>

        <div className="border-destructive/35 bg-card mt-3 border p-5">
          <h3 className="text-[15px] leading-snug font-medium">Delete this team</h3>
          {personal ? (
            <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
              This is your personal team, so it can&apos;t be deleted. It goes away with your
              account.
            </p>
          ) : isOwner ? (
            <>
              <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                Removes the team, its members, its GitHub connections and every project in it —
                components, tests, run history and notification settings. This cannot be undone. The
                GitHub App stays installed on GitHub.
              </p>
              <DeleteTeamForm teamId={teamId} teamName={team.name} />
            </>
          ) : (
            <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
              Only owners can delete the team. To stop being on it, leave from Members.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 px-5 py-4">
      <dt className="text-muted-foreground w-32 shrink-0 text-[13px]">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">{value}</dd>
    </div>
  );
}
