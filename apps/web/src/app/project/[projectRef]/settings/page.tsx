import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { ApiKeySettings } from "@/components/projects/api-key-settings";
import { requireUser } from "@/lib/auth/user";
import { isAiProvider, type AiProviderId } from "@/lib/projects/ai-providers";

// 프로젝트 설정. 지금은 API 키 한 섹션뿐이다.
//
// 온보딩이 끝나면 setup 화면은 문지기(setup/[projectRef]/layout.tsx)가 막으므로,
// 키를 바꾸는 길은 여기 하나다.
export default async function SettingsPage({
  params,
}: PageProps<"/project/[projectRef]/settings">) {
  const user = await requireUser();
  const { projectRef } = await params;

  // 권한 검사는 앱 코드에서 (AGENTS.md).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, userId: user.id },
    select: { id: true },
  });
  if (!project) notFound();

  // 평문·암호문은 절대 클라이언트로 내리지 않는다 — 끝 4자리만.
  const keys = await prisma.userApiKey.findMany({
    where: { userId: user.id },
    select: { provider: true, lastFour: true },
  });

  const savedKeys: Partial<Record<AiProviderId, string>> = {};
  for (const key of keys) {
    if (isAiProvider(key.provider)) savedKeys[key.provider] = key.lastFour;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-[22px] leading-tight font-medium tracking-[-0.02em]">
        Settings
      </h1>

      <section className="mt-8">
        <h2 className="font-heading text-[15px] font-medium">API keys</h2>
        <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
          Keys belong to your account, not to this project — replacing one here changes it for every
          project you have connected. Stored encrypted; only the last four digits are ever shown.
        </p>

        <div className="mt-4">
          <ApiKeySettings projectRef={projectRef} savedKeys={savedKeys} />
        </div>
      </section>
    </div>
  );
}
