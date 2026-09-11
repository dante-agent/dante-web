import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";

// 프로젝트 일반. 지금은 읽기 전용 요약뿐이다.
//
// 이름은 여기서 바꾸지 않는다 — 레포 이름을 그대로 따라간다(rename 되면 웹훅이
// 같이 고친다, lib/github/webhook.ts). 삭제는 GitHub 설치·키와 얽혀 있어 따로 온다.
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

  return (
    <>
      <SettingsHeader
        title="General"
        description="What this project points at. One project is one GitHub repository, and it takes the repository's name — rename the repository on GitHub to rename the project."
      />

      <dl className="border-border divide-border bg-card mt-8 max-w-2xl divide-y border">
        <Field label="Name" value={project.name} />
        <Field label="Repository" value={`${project.repoOwner}/${project.repoName}`} />
        <Field label="Default branch" value={project.defaultBranch} />
        <Field label="Test runner" value={project.testFramework ?? "not picked"} />
        <Field label="Reference" value={project.ref} />
      </dl>

      <ComingSoon>
        Deleting the project. It has to decide what happens to the GitHub installation when it is
        the last project using it, so it comes with the GitHub page.
      </ComingSoon>
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
