import { prisma } from "@dante/db";
import { ApiKeySettings } from "@/components/account/api-key-settings";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";
import { isAiProvider, type AiProviderId } from "@/lib/projects/ai-providers";

// AI 모델 + API 키.
//
// 온보딩이 끝나면 setup 화면은 문지기(setup/[projectRef]/layout.tsx)가 막으므로,
// 키를 바꾸는 길은 여기 하나다.
export default async function AccountAiPage() {
  const user = await requireUser();

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
    <>
      <SettingsHeader
        title="AI models"
        description="Keys belong to your account, not to a single project — replacing one here changes it for every project you have connected. Stored encrypted; only the last four digits are ever shown."
      />

      <div className="mt-8 max-w-2xl">
        <ApiKeySettings savedKeys={savedKeys} />
      </div>

      <ComingSoon>
        Picking the model per provider (Sonnet vs. Opus, say) and a default for new projects. Right
        now the provider you hold a key for decides it.
      </ComingSoon>
    </>
  );
}
