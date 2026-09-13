"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings, Users } from "lucide-react";
import { switchTeam } from "@/app/team/actions";
import { HeaderSwitcher, SwitcherRow } from "@/components/header-switcher";
import type { TeamOption } from "@/lib/teams/current";

// 헤더 로고 옆 팀 드롭다운. 고르면 쿠키(지금 팀)를 바꾸고 이동한다.
//
// landing: 어디로 보낼지. 프로젝트 화면·목록에서는 그 팀의 프로젝트 목록으로,
// 팀 설정에서는 고른 팀의 설정으로. 다른 팀 프로젝트 화면에 머물 수는 없다.
export function TeamSwitcher({
  teams,
  value,
  landing,
}: {
  teams: TeamOption[];
  value: string;
  landing: "projects" | "settings";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <HeaderSwitcher
      value={value}
      items={teams.map((team) => ({ value: team.id, label: team.name }))}
      findLabel="Find team…"
      icon={<Users className="text-muted-foreground size-3.5 shrink-0" />}
      onSelect={(id) =>
        startTransition(() =>
          switchTeam(id, landing === "settings" ? `/team/${id}/settings/general` : "/projects")
        )
      }
      footer={
        <>
          <SwitcherRow onClick={() => router.push(`/team/${value}/settings/general`)}>
            <Settings className="size-4" />
            Team settings
          </SwitcherRow>
          <SwitcherRow onClick={() => router.push("/account/settings/teams")}>
            <Plus className="size-4" />
            New team
          </SwitcherRow>
        </>
      }
    />
  );
}
