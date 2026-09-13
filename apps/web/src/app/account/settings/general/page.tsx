import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { DeleteAccountForm } from "@/components/settings/general/delete-account-form";
import { SettingsHeader } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { accountConfirmation, soleOwnerTeams } from "@/lib/account/delete";
import { requireUser } from "@/lib/auth/user";

// 계정 일반. 읽기 전용 요약 + 로그아웃 + 맨 아래 계정 삭제.
//
// 이메일·핸들은 Supabase auth 가 소유한 값이라 우리가 여기서 고칠 수 없다.
// (public.users 는 미러일 뿐 — lib/auth/user.ts 의 syncUser 참고.) 그래서
// 이름 변경 같은 건 두지 않고, 어떤 계정으로 로그인해 있는지만 보여준다.
export default async function AccountGeneralPage() {
  const user = await requireUser();

  const handle = user.user_metadata.user_name as string | undefined;
  // provider 는 로그인 수단. GitHub 로 들어왔는지 Google 로 들어왔는지.
  const provider = (user.app_metadata.provider as string | undefined) ?? "unknown";

  // 혼자 owner 인 공유 팀이 있으면 버튼 대신 그 팀들을 보여준다. 액션도 다시 검사한다.
  const blocking = await soleOwnerTeams(user.id);

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

      <section className="mt-12 max-w-2xl">
        <h2 className="text-destructive/80 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
          Danger zone
        </h2>

        <div className="border-destructive/35 bg-card mt-3 border p-5">
          <h3 className="text-[15px] leading-snug font-medium">Delete your account</h3>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
            Removes your personal team with its projects and GitHub connections, your AI usage and
            chat history, and your editor sign-ins. You leave every other team — its projects stay
            with the team. This cannot be undone. The GitHub App stays installed on GitHub.
          </p>

          {blocking.length > 0 ? (
            <div className="mt-4">
              <p className="text-[13px] leading-relaxed">
                You&apos;re the only owner of these teams. Make someone else an owner, or delete the
                team, before deleting your account.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {blocking.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/team/${team.id}/settings/members`}
                      className="font-mono text-[13px] underline-offset-4 hover:underline"
                    >
                      {team.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <DeleteAccountForm confirmation={accountConfirmation(user)} />
          )}
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
