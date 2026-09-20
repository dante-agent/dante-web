"use client";

// 최상단 헤더 (project 스코프). 로고 / owner / repo 브레드크럼 · 검색 · Feedback · 프로필.
// 검색은 오른쪽 그룹 옆에 붙는다(GitHub 식) — 브레드크럼과 같은 flex 줄이라 겹칠 수가 없다.
// 데이터는 project layout 이 넘겨준다. 파일 검색 목록은 PR B(레포 트리)에서 연결.
// 프로필은 드롭다운(user-menu). Feedback 은 구글폼 설문을 새 탭으로 연다.

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Blocks, Box, Plus } from "lucide-react";
import danteLogo from "@/assets/dante-logo.png";
import { FeedbackLink } from "@/components/feedback-link";
import { FileSearch } from "@/components/file-search";
import { HeaderSwitcher, SwitcherRow } from "@/components/header-switcher";
import { TeamSwitcher } from "@/components/team-switcher";
import { UserMenu, type HeaderUser } from "@/components/user-menu";
import type { ProjectSummary } from "@/lib/projects/queries";
import type { TeamOption } from "@/lib/teams/current";

function Slash() {
  return (
    <span aria-hidden="true" className="text-muted-foreground/40 text-sm select-none">
      /
    </span>
  );
}

export function AppHeader({
  project,
  projects,
  teams,
  user,
}: {
  project: ProjectSummary;
  /** 이 프로젝트와 같은 팀의 프로젝트만 온다(requireProjectContext). */
  projects: ProjectSummary[];
  teams: TeamOption[];
  user: HeaderUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const owner = project.repoOwner;
  const owners = [...new Set(projects.map((p) => p.repoOwner))];
  const ownerProjects = projects.filter((p) => p.repoOwner === owner);

  // 프로젝트를 바꿔도 같은 섹션(folder / settings/github …)에 머문다. 쿼리는 새 레포에서 무의미하니 버린다.
  const section = pathname.split("/").slice(3).join("/") || "dashboard";
  const goto = (ref: string) => router.push(`/project/${ref}/${section}`);

  // 새 org 연결 = 풀 플로우(/projects/new), 이미 연결된 org 에 레포 추가 = 레포 고르는 화면 바로
  const newRow = (label: string, href: string) => (
    <SwitcherRow onClick={() => router.push(href)}>
      <Plus className="size-4" />
      {label}
    </SwitcherRow>
  );

  return (
    <header className="bg-sidebar border-sidebar-border fixed inset-x-0 top-0 z-40 flex h-[47px] items-center border-b pr-3">
      {/* 로고 = 메인 레일(w-14)과 같은 열 → 첫 구분자가 레일 border-r 선에 맞음 */}
      <div className="flex h-full w-14 shrink-0 items-center pl-[18px]">
        <Link href="/projects" aria-label="Dante">
          <Image src={danteLogo} alt="" draggable={false} className="h-5 w-[15px] select-none" />
        </Link>
      </div>

      {/* 좁아지면 앞 세그먼트부터 말줄임된다. 숨기지는 않는다 — 경로는 지금 어디인지를 알려주는 유일한 표시다. */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 shrink items-center gap-4">
        {/* 팀은 쿠키가 아니라 이 프로젝트의 팀이다(lib/teams/current.ts). */}
        <Slash />
        <TeamSwitcher teams={teams} value={project.teamId} landing="projects" />

        <Slash />
        <HeaderSwitcher
          kind="Organization"
          value={owner}
          items={owners.map((o) => ({ value: o, label: o }))}
          findLabel="Find organization…"
          onSelect={(o) => {
            const target = projects.find((p) => p.repoOwner === o);
            if (target) goto(target.ref);
            else router.push("/projects");
          }}
          icon={<Blocks className="text-muted-foreground size-3.5 shrink-0" />}
          footer={
            <>
              <SwitcherRow onClick={() => router.push("/projects")}>All organizations</SwitcherRow>
              {newRow("New organization", "/projects/new")}
            </>
          }
        />

        <Slash />
        <HeaderSwitcher
          kind="Repository"
          value={project.ref}
          items={ownerProjects.map((p) => ({ value: p.ref, label: p.name }))}
          findLabel="Find repository…"
          onSelect={goto}
          icon={<Box className="text-muted-foreground size-3.5 shrink-0" />}
          footer={newRow("New repository", "/projects/new/github")}
          // 레포 이름은 안 줄인다 — 셋 중 제일 중요하다.
          className="shrink-0"
        />
      </nav>

      {/* ml-auto 는 검색창이 가져간다 — 오른쪽 그룹에 붙어 고정되니 브레드크럼이 길어져도 안 밀린다.
          shrink-0 을 주면 안 된다: 좁아질 때 검색창이 320px 을 붙들고 있어 브레드크럼만 찌그러진다. */}
      <div className="ml-auto flex min-w-0 shrink items-center pl-3">
        <FileSearch projectRef={project.ref} />
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-3">
        {/* 없으면 검색창이 Feedback·프로필과 한 덩어리로 읽힌다. */}
        <span aria-hidden="true" className="bg-border mr-1 h-4 w-px" />
        <FeedbackLink />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
