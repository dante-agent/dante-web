import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";
import { AcceptInvite } from "@/components/team/accept-invite";
import { buttonVariants } from "@/components/ui/button";
import { displayName, requireUser } from "@/lib/auth/user";
import { getTeamRole } from "@/lib/teams/access";
import { findInvite } from "@/lib/teams/invites";

export const metadata: Metadata = { title: "Team invite" };

// 초대 메일의 링크가 오는 곳.
//
// 공개 경로가 아니다. 로그인하지 않았으면 proxy 가 ?next 를 붙여 로그인으로 보냈다가
// 여기로 되돌려준다. 여는 것만으로는 수락되지 않는다 — 메일 보안 스캐너가 링크를 미리
// 열어 보는 일이 흔해서, 사람이 버튼을 눌러야(POST) 링크가 소모된다.
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await requireUser();
  const invite = await findInvite(token);

  if (!invite) {
    return (
      <Frame>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          This invite doesn&apos;t work
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          It has expired, was already used, or was revoked. Ask a team owner to send a new one.
        </p>
        <GoToProjects />
      </Frame>
    );
  }

  if (await getTeamRole(invite.teamId, user.id)) {
    return (
      <Frame>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          You&apos;re already on {invite.teamName}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Signed in as {user.email ?? displayName(user)}. There is nothing to accept.
        </p>
        <GoToProjects />
      </Frame>
    );
  }

  return (
    <Frame>
      <AcceptInvite
        token={token}
        teamName={invite.teamName}
        inviterName={invite.inviterName}
        invitedEmail={invite.email}
        account={user.email ?? displayName(user)}
        accountEmail={user.email?.toLowerCase() ?? null}
      />
    </Frame>
  );
}

function GoToProjects() {
  return (
    <Link
      href="/projects"
      className={buttonVariants({ variant: "outline", size: "lg", className: "mt-8 h-10 w-full" })}
    >
      Go to projects
    </Link>
  );
}

// auth/extension/page.tsx 와 같은 틀. 로그인 화면 계열의 한 장짜리 화면이다.
function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background-warm flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Image
          src={danteLogo}
          alt="Dante"
          priority
          draggable={false}
          className="h-8 w-6 select-none"
        />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
