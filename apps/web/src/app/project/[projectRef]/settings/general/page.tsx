import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { DeleteProjectForm } from "@/components/settings/general/delete-project-form";
import { SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";

// 프로젝트 일반. 읽기 전용 요약 + 맨 아래 삭제.
//
// 이름은 여기서 바꾸지 않는다 — 레포 이름을 그대로 따라간다(rename 되면 웹훅이
// 같이 고친다, lib/github/webhook.ts). 삭제가 무엇을 지우고 무엇을 남기는지는
// actions.ts 주석에 있다.
export default async function ProjectGeneralPage({
  params,
}: PageProps<"/project/[projectRef]/settings/general">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 레이아웃에서 이미 소유를 확인했지만, 페이지가 레이아웃의 검사에 기대면
  // 나중에 레이아웃이 바뀔 때 조용히 뚫린다. 각자 확인한다 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: {
      name: true,
      ref: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      testFramework: true,
    },
  });
  if (!project) notFound();

  const repoFullName = `${project.repoOwner}/${project.repoName}`;

  return (
    <>
      <SettingsHeader
        title="General"
        description="What this project points at. One project is one GitHub repository, and it takes the repository's name — rename the repository on GitHub to rename the project."
      />

      <dl className="border-border divide-border bg-card mt-8 max-w-2xl divide-y border">
        <Field label="Name" value={project.name} />
        <Field label="Repository" value={repoFullName} />
        <Field label="Default branch" value={project.defaultBranch} />
        <Field label="Test runner" value={project.testFramework ?? "not picked"} />
        <Field label="Reference" value={project.ref} />
      </dl>

      {/* 되돌릴 수 없는 동작은 맨 아래, 빨간 테두리 안에 따로 둔다. 위의 요약을
          읽으러 온 사용자가 스쳐 지나가다 누르지 않게. */}
      <section className="mt-12 max-w-2xl">
        <h2 className="text-destructive/80 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
          Danger zone
        </h2>

        <div className="border-destructive/35 bg-card mt-3 border p-5">
          <h3 className="text-[15px] leading-snug font-medium">Delete this project</h3>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
            Removes the project and everything Dante stored for it — components, tests, run history
            and notification settings. This cannot be undone. The GitHub App stays installed, and
            comments and checks already posted on pull requests stay where they are.
          </p>

          <DeleteProjectForm projectRef={project.ref} repoFullName={repoFullName} />
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
