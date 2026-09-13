import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { selectFramework } from "@/app/projects/(onboarding)/setup/[projectRef]/actions";
import { StepHeader } from "@/components/projects/step-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { TEST_FRAMEWORKS } from "@/lib/projects/frameworks";

// 온보딩 3단계 — 테스트 러너 고르기.
//
// /project/<ref>/... 가 아니라 /projects/setup/... 아래 두는 이유: 프로젝트
// 스코프 레이아웃에는 사이드바가 붙는데, 아직 설정이 끝나지 않은 프로젝트를
// 완성된 앱 셸 안에서 보여주면 어긋난다. 온보딩은 /projects 셸을 그대로 쓴다.
export default async function FrameworkPage({
  params,
}: PageProps<"/projects/setup/[projectRef]/framework">) {
  const user = await requireUser();
  const { projectRef } = await params;

  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: { name: true, repoOwner: true, repoName: true, testFramework: true },
  });
  if (!project) notFound();

  // 이미 고른 적이 있으면 그 값을 켜둔다(뒤로 와서 바꾸는 경우).
  const selected = project.testFramework ?? TEST_FRAMEWORKS[0].id;

  return (
    <>
      <StepHeader
        title="How do you run tests?"
        description="Dante writes test files to match. File location and imports differ by runner"
      />

      <p className="text-muted-foreground mt-4 font-mono text-[11px] tracking-wide">
        {project.repoOwner}/{project.repoName}
      </p>

      <form action={selectFramework} className="mt-6">
        <input type="hidden" name="projectRef" value={projectRef} />

        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Test runner</legend>

          {TEST_FRAMEWORKS.map((framework) => (
            // 라디오를 숨기고 label 전체를 누르게 한다. 선택 표시는 has-[:checked]
            // 로 CSS 가 처리하므로 이 화면에는 클라이언트 JS 가 필요 없다.
            <label
              key={framework.id}
              className="border-border bg-card hover:border-input block cursor-pointer border p-6 transition-colors duration-[180ms] ease-out has-[:checked]:border-[#ff570a] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#ff570a]/40"
            >
              <input
                type="radio"
                name="framework"
                value={framework.id}
                defaultChecked={selected === framework.id}
                className="sr-only"
              />
              <div className="flex items-baseline gap-3">
                <span className="font-heading text-lg leading-tight font-medium">
                  {framework.name}
                </span>
                {project.testFramework === framework.id && (
                  <span className="text-brand-mint font-mono text-[10px] font-bold tracking-[0.12em]">
                    CURRENT
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
                {framework.tagline}
              </p>
              <div className="border-border mt-5 border-t pt-3">
                <p className="text-muted-foreground font-mono text-[10px] tracking-wide">
                  {framework.example}
                </p>
              </div>
            </label>
          ))}
        </fieldset>

        <Button type="submit" size="lg" className="mt-6 w-full rounded-[4px]">
          Continue
        </Button>
      </form>
    </>
  );
}
