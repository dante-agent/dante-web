import { signOut } from "@/app/auth/actions";
import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";

// 계정 일반. 지금은 읽기 전용 요약 + 로그아웃뿐이다.
//
// 이메일·핸들은 Supabase auth 가 소유한 값이라 우리가 여기서 고칠 수 없다.
// (public.users 는 미러일 뿐 — lib/auth/user.ts 의 syncUser 참고.) 그래서
// 이름 변경 같은 건 두지 않고, 어떤 계정으로 로그인해 있는지만 보여준다.
export default async function AccountGeneralPage() {
  const user = await requireUser();

  const handle = user.user_metadata.user_name as string | undefined;
  // provider 는 로그인 수단. GitHub 로 들어왔는지 Google 로 들어왔는지.
  const provider = (user.app_metadata.provider as string | undefined) ?? "unknown";

  return (
    <>
      <SettingsHeader
        title="General"
        description="Which account you are signed in as. Email and handle come from your sign-in provider — change them there, not here."
      />

      <dl className="border-border divide-border bg-card mt-8 max-w-2xl divide-y border">
        <Field label="Email" value={user.email ?? "—"} />
        <Field label="Handle" value={handle ?? "—"} />
        <Field label="Signed in with" value={provider} />
      </dl>

      <div className="mt-6">
        {/* 서버 액션이라 <form> 이 필요하다. Base UI Button 은 기본 type 이
            button 이라 submit 을 명시하지 않으면 폼이 제출되지 않는다. */}
        <form action={signOut}>
          <Button type="submit" size="sm" variant="secondary" className="rounded-[4px]">
            Sign out
          </Button>
        </form>
      </div>

      <ComingSoon>
        Deleting your account — it has to remove every project, GitHub installation and stored key
        in one go, so it lands with the team model rather than before it.
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
