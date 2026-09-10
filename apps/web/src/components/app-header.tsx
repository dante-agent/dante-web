"use client";

// 최상단 헤더 (project 스코프). 로고 / owner / repo 브레드크럼 · 검색 · Feedback · 프로필.
// 데이터는 목업. Feedback·프로필은 버튼만 (모달/드롭다운 미구현).

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Blocks, Box, Plus } from "lucide-react";
import danteLogo from "@/assets/dante-logo.png";
import { FileSearch } from "@/components/file-search";
import { HeaderSwitcher, SwitcherRow } from "@/components/header-switcher";
import { Button } from "@/components/ui/button";
import { mockFileTree, mockOwners, mockProjects, projectsByOwner } from "@/lib/mock-data";

function Slash() {
  return <span className="text-muted-foreground/40 text-sm select-none">/</span>;
}

export function AppHeader({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const project = mockProjects.find((p) => p.ref === projectRef) ?? mockProjects[0];
  const owner = project.repoFullName.split("/")[0];

  const newProject = (
    <SwitcherRow onClick={() => router.push("/projects/new")}>
      <Plus className="size-4" />
      New project
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
          items={mockOwners.map((o) => ({ value: o.id, label: o.name }))}
          findLabel="Find owner…"
          onSelect={() => router.push("/projects")}
          icon={<Blocks className="text-muted-foreground size-3.5 shrink-0" />}
          footer={
            <>
              <SwitcherRow onClick={() => router.push("/projects")}>All projects</SwitcherRow>
              {newProject}
            </>
          }
        />

        <Slash />
        <HeaderSwitcher
          value={project.ref}
          items={projectsByOwner(owner).map((p) => ({ value: p.ref, label: p.name }))}
          findLabel="Find repository…"
          onSelect={(v) => router.push(`/project/${v}/dashboard`)}
          icon={<Box className="text-muted-foreground size-3.5 shrink-0" />}
          footer={newProject}
        />
      </div>

      <div className="mx-auto w-full max-w-xl">
        <FileSearch projectRef={project.ref} files={mockFileTree.map((e) => e.path)} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm">
          Feedback
        </Button>
        <button
          type="button"
          aria-label="프로필"
          className="border-border bg-muted hover:bg-muted/70 size-7 rounded-full border transition-colors"
        />
      </div>
    </header>
  );
}
