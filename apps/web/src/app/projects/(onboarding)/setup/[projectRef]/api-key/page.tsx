import { notFound, redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { ApiKeyForm } from "@/components/projects/api-key-form";
import { BackLink } from "@/components/projects/back-link";
import { StepHeader } from "@/components/projects/step-header";
import { requireUser } from "@/lib/auth/user";
import { isAiProvider, type AiProviderId } from "@/lib/projects/ai-providers";

// 온보딩 4단계 — 어떤 모델이 테스트를 쓸지 고르고 키를 넣는다.
//
// 마지막 단계라 여기서 setupCompletedAt 을 찍는다(건너뛰어도 찍는다 — actions.ts).
export default async function ApiKeyPage({
  params,
}: PageProps<"/projects/setup/[projectRef]/api-key">) {
  const user = await requireUser();
  const { projectRef } = await params;

  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: { repoOwner: true, repoName: true, testFramework: true },
  });
  if (!project) notFound();

  // 3단계를 건너뛰고 이 URL 로 바로 들어오는 걸 막는다. 그냥 두면 러너를 안 고른
  // 채로 온보딩이 완료 처리되고(testFramework = null), 나중에 테스트를 만들 때
  // 파일 이름 규칙과 import 를 정할 근거가 없어진다.
  // "이미 끝난 온보딩" 검사는 이 폴더의 layout.tsx 가 맡는다.
  if (!project.testFramework) redirect(`/projects/setup/${projectRef}/framework`);

  // 키는 사용자 단위라 다른 프로젝트에서 넣어둔 게 있으면 그대로 쓸 수 있다.
  // 평문·암호문은 절대 클라이언트로 내리지 않는다 — 끝 4자리만.
  const keys = await prisma.userApiKey.findMany({
    where: { userId: user.id },
    select: { provider: true, lastFour: true },
  });

  const savedKeys: Partial<Record<AiProviderId, string>> = {};
  for (const key of keys) {
    // DB 에는 우리가 목록에서 뺀 프로바이더가 남아 있을 수 있다.
    if (isAiProvider(key.provider)) savedKeys[key.provider] = key.lastFour;
  }

  return (
    <>
      <div className="mb-6">
        <BackLink href={`/projects/setup/${projectRef}/framework`}>Change test runner</BackLink>
      </div>

      <StepHeader
        title="Which model writes the tests?"
        description="Dante calls the model with your own key, so usage is billed to you and your code never trains anyone's model"
      />

      <p className="text-muted-foreground mt-4 font-mono text-[11px] tracking-wide">
        {project.repoOwner}/{project.repoName}
      </p>

      <ApiKeyForm projectRef={projectRef} savedKeys={savedKeys} />

      {/* 가장 흔한 오해를 미리 끊는다. 구독을 결제해둔 사용자가 "왜 또 돈을
          내라는 거냐"로 이탈하는 걸 막으려는 문장이다. */}
      <p className="text-muted-foreground/80 border-border mt-8 border-t pt-4 text-[13px] leading-relaxed">
        A Claude, ChatGPT, or Gemini subscription does not include API access — the two are billed
        separately, and no provider lets an outside app borrow a subscription. Keys from the
        consoles above are pay-as-you-go, and a run over one repository usually costs cents.
      </p>
    </>
  );
}
