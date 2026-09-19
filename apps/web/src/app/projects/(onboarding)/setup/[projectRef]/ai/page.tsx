import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { EngineCards } from "@/components/ai/engine-cards";
import { BackLink } from "@/components/projects/back-link";
import { StepHeader } from "@/components/projects/step-header";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireUser } from "@/lib/auth/user";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { ACTIVE_ENGINE } from "@/lib/ai/engine";
import { finishSetup } from "../actions";

export const metadata: Metadata = { title: "AI engine" };

// 온보딩 4단계 — 무엇이 테스트를 쓰는지 알리고 끝낸다.
//
// 예전에는 여기서 프로바이더를 고르고 API 키를 넣었다. 지금은 Dante 가
// 프로바이더와 직접 계약하므로 사용자가 할 일이 없다. 단계를 아예 없애지 않은
// 이유는, "무엇이 내 코드를 읽는가"는 마지막에 한 번 말해줄 값어치가 있어서다.
//
// 마지막 단계라 여기서 setupCompletedAt 을 찍는다(actions.ts 의 finishSetup).
export default async function AiPage({ params }: PageProps<"/projects/setup/[projectRef]/ai">) {
  const user = await requireUser();
  const { projectRef } = await params;

  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: { repoOwner: true, repoName: true, testFramework: true },
  });
  if (!project) notFound();

  // 3단계를 건너뛰고 이 URL 로 바로 들어오는 걸 막는다. 그냥 두면 러너를 안 고른
  // 채로 온보딩이 완료 처리되고(testFramework = null), 나중에 테스트를 만들 때
  // 파일 이름 규칙과 import 를 정할 근거가 없어진다.
  // "이미 끝난 온보딩" 검사는 이 폴더의 layout.tsx 가 맡는다.
  if (!project.testFramework) redirect(`/projects/setup/${projectRef}/framework`);

  return (
    <>
      <div className="mb-6">
        <BackLink href={`/projects/setup/${projectRef}/framework`}>Change test runner</BackLink>
      </div>

      <StepHeader
        title={`${ACTIVE_ENGINE.name} writes your tests`}
        description="Already connected — there is no key to paste and nothing to install."
      />

      <p className="text-muted-foreground mt-4 font-mono text-[11px] tracking-wide">
        {project.repoOwner}/{project.repoName}
      </p>

      <div className="mt-6">
        <EngineCards />
      </div>

      {/* 누를 것이 하나뿐이라 클라이언트 컴포넌트가 필요 없다 — 폼이 서버 액션을
          그대로 부른다. 실패 경로가 없으므로(소유 검사에 걸리면 404) 돌려줄
          상태도 없고, useActionState 도 쓰지 않는다. 고를 엔진이 하나라 폼에
          실어 보낼 값도 없다 — 어느 엔진을 부를지는 서버가 안다. */}
      <form action={finishSetup} className="mt-6">
        <input type="hidden" name="projectRef" value={projectRef} />
        <PendingSubmitButton
          pendingLabel="Finishing setup…"
          size="lg"
          className="w-full rounded-[4px]"
        >
          Finish
        </PendingSubmitButton>
      </form>
    </>
  );
}
