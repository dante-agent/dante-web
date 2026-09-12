import { EngineCards } from "@/components/ai/engine-cards";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { ACTIVE_ENGINE } from "@/lib/ai/engine";
import { requireUser } from "@/lib/auth/user";

// AI 엔진.
//
// 예전에는 프로바이더별 키를 넣고 지우는 화면이었다. 지금은 Dante 가 프로바이더와
// 직접 계약하므로 관리할 키가 없다 — 무엇이 붙어 있는지만 알린다.
// 카드는 온보딩 4단계와 같은 것을 쓴다(components/ai/engine-cards.tsx).
export default async function AccountAiPage() {
  // 로그인 확인만 한다. 보여줄 값이 사용자마다 다르지 않아 조회는 없다.
  await requireUser();

  return (
    <>
      <SettingsHeader
        title="AI"
        description={`Dante calls ${ACTIVE_ENGINE.name} on your behalf. There is no key to manage.`}
      />

      <div className="mt-8 max-w-2xl">
        <EngineCards />
      </div>

      <ComingSoon>
        Credit balance and this month&apos;s usage, plans, picking generation quality (Standard vs.
        Deep), and overriding the engine per project.
      </ComingSoon>
    </>
  );
}
