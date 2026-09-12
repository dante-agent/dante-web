import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { ENGINE } from "@/lib/ai/engine";
import { requireUser } from "@/lib/auth/user";

// AI 엔진.
//
// 예전에는 프로바이더별 키를 넣고 지우는 화면이었다. 지금은 Dante 가 프로바이더와
// 직접 계약하므로 관리할 키가 없다 — 무엇이 붙어 있는지만 알린다.
export default async function AccountAiPage() {
  // 로그인 확인만 한다. 보여줄 값이 사용자마다 다르지 않아 조회는 없다.
  await requireUser();

  return (
    <>
      <SettingsHeader
        title="AI"
        description={`Dante calls ${ENGINE.name} on your behalf. There is no key to manage.`}
      />

      <div className="border-border mt-8 flex max-w-2xl items-baseline justify-between border-b pb-4">
        <span className="text-[13px] font-medium">Engine</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[13px]">{ENGINE.name}</span>
          <span className="text-muted-foreground text-[13px]">{ENGINE.vendor}</span>
        </span>
      </div>

      <ComingSoon>
        Credit balance and this month&apos;s usage, plans, picking generation quality (Standard vs.
        Deep), and overriding the engine per project.
      </ComingSoon>
    </>
  );
}
