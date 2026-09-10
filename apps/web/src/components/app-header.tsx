"use client";

// 최상단 헤더 (project 스코프). 로고 / owner / repo 브레드크럼 · 검색 · Feedback · 프로필.
// 데이터는 project layout 이 넘겨준다. 파일 검색 목록은 PR B(레포 트리)에서 연결.
// Feedback·프로필은 버튼만 (모달/드롭다운 미구현).

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Blocks, Box, Plus } from "lucide-react";
import danteLogo from "@/assets/dante-logo.png";
import { FileSearch } from "@/components/file-search";
import { HeaderSwitcher, SwitcherRow } from "@/components/header-switcher";
import { Button } from "@/components/ui/button";
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
  const owner = project.repoOwner;
  const owners = [...new Set(projects.map((p) => p.repoOwner))];
  const ownerProjects = projects.filter((p) => p.repoOwner === owner);

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

      <div className="flex shrink-0 items-center gap-4">
        <Slash />
        <HeaderSwitcher
          value={owner}
          items={owners.map((o) => ({ value: o, label: o }))}
          findLabel="Find organization…"
          onSelect={() => router.push("/projects")}
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
          onSelect={(v) => router.push(`/project/${v}/dashboard`)}
          icon={<Box className="text-muted-foreground size-3.5 shrink-0" />}
          footer={newRow("New repository", "/projects/new/github")}
        />
      </div>

      <div className="mx-auto w-full max-w-xl">
        <FileSearch projectRef={project.ref} files={[]} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm">
          Feedback
        </Button>
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
