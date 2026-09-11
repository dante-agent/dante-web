"use client";

// 최상단 헤더 (project 스코프). 로고 / owner / repo 브레드크럼 · 검색 · Feedback · 프로필.
// 데이터는 project layout 이 넘겨준다. 파일 검색 목록은 PR B(레포 트리)에서 연결.
// 프로필은 버튼만 (드롭다운 미구현). Feedback 은 문의 모달(feedback-dialog).

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Blocks, Box, Plus } from "lucide-react";
import danteLogo from "@/assets/dante-logo.png";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { FileSearch } from "@/components/file-search";
import { HeaderSwitcher, SwitcherRow } from "@/components/header-switcher";
import { UserAvatar } from "@/components/user-avatar";
import type { ProjectSummary } from "@/lib/projects/queries";

/** 헤더가 쓰는 사용자 정보만. Supabase User 를 통째로 클라이언트에 넘기지 않는다. */
export type HeaderUser = { name: string; avatarUrl: string | null };

function Slash() {
  return <span className="text-muted-foreground/40 text-sm select-none">/</span>;
}

export function AppHeader({
  project,
  projects,
  user,
}: {
  project: ProjectSummary;
  projects: ProjectSummary[];
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
      {/* 검색창은 브레드크럼 길이와 무관하게 화면 중앙 고정 (레이아웃 시프트 방지) */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-xl">
          <FileSearch projectRef={project.ref} files={[]} />
        </div>
      </div>

      {/* 로고 = 메인 레일(w-14)과 같은 열 → 첫 구분자가 레일 border-r 선에 맞음 */}
      <div className="flex h-full w-14 shrink-0 items-center pl-[18px]">
        <Link href="/projects" aria-label="Dante">
          <Image src={danteLogo} alt="" draggable={false} className="h-5 w-[15px] select-none" />
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <Slash />
        <HeaderSwitcher
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
          value={project.ref}
          items={ownerProjects.map((p) => ({ value: p.ref, label: p.name }))}
          findLabel="Find repository…"
          onSelect={goto}
          icon={<Box className="text-muted-foreground size-3.5 shrink-0" />}
          footer={newRow("New repository", "/projects/new/github")}
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <FeedbackDialog />
        <button
          type="button"
          aria-label={`${user.name} 프로필`}
          className="rounded-full opacity-100 transition-opacity hover:opacity-80"
        >
          <UserAvatar src={user.avatarUrl} name={user.name} />
        </button>
      </div>
    </header>
  );
}
