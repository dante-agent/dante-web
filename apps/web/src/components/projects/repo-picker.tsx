"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lock, Search } from "lucide-react";
import { importRepo } from "@/app/projects/(onboarding)/new/github/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InstallationRepo } from "@/lib/github/repos";

// 설치가 열어준 레포 목록.
//
// 행마다 Import 버튼을 둔다 (Vercel 방식). "선택 → 하단 버튼" 2단계보다 클릭이
// 하나 적고, 어떤 레포를 고른 상태인지 기억할 필요가 없다.
//
// 생김새는 CodeRabbit 기준 — 각진 테두리(radius 0), 행 사이는 헤어라인,
// 기술적인 메타데이터는 Hack mono (DESIGN.md §3).
//
// bigint 는 서버 컴포넌트에서 클라이언트로 넘길 때 직렬화되지 않는다.
// 그래서 설치 ID·프로젝트 ref 는 문자열 맵으로 받는다.
export function RepoPicker({
  repos,
  refByRepoId,
  installationIdByRepoId,
  settingsUrl,
}: {
  repos: InstallationRepo[];
  refByRepoId: Record<string, string>;
  installationIdByRepoId: Record<string, string>;
  settingsUrl: string;
}) {
  const [owner, setOwner] = useState<string>("");
  const [query, setQuery] = useState("");

  // 설치가 여러 계정(개인 + 조직)에 걸쳐 있을 수 있다.
  const owners = useMemo(() => [...new Set(repos.map((repo) => repo.owner))].sort(), [repos]);
  const activeOwner = owner || owners[0] || "";

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return repos.filter(
      (repo) => repo.owner === activeOwner && (!needle || repo.name.toLowerCase().includes(needle))
    );
  }, [repos, activeOwner, query]);

  return (
    <>
      <div className="flex gap-2">
        {/* 네이티브 <select> 를 쓰다가 교체했다. appearance:auto 면 브라우저가
            화살표를 직접 그리면서 좌우 여백이 어긋나고, 열었을 때 팝업 위치도
            OS 가 정해서 CSS 로 못 맞춘다. 옆의 검색 입력과 글꼴·배경도 달랐다. */}
        <Select value={activeOwner} onValueChange={(value) => setOwner(String(value))}>
          {/* SelectTrigger 의 기본 클래스에 data-[size=default]:h-8 이 들어 있어
              h-9 만으로는 안 먹는다(선택자가 달라 tailwind-merge 가 못 합친다).
              옆 검색 입력과 높이를 맞추려면 같은 선택자로 덮어야 한다. */}
          <SelectTrigger className="shrink-0 rounded-[4px] data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          {/* alignItemWithTrigger 기본값(true)은 선택 항목을 트리거 위에 겹쳐
              띄운다(macOS 네이티브 방식). 트리거를 가리고 옆 입력까지 넘어와서
              아래로 펼치도록 끈다. */}
          <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
            {owners.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search repositories"
            className="bg-card h-9 rounded-[4px] pl-9 text-sm md:text-sm"
          />
        </div>
      </div>

      <ul className="border-border divide-border bg-card mt-3 divide-y border">
        {visible.map((repo) => (
          <RepoRow
            key={repo.id}
            repo={repo}
            projectRef={refByRepoId[String(repo.id)]}
            installationId={installationIdByRepoId[String(repo.id)]}
          />
        ))}
        {visible.length === 0 && (
          <li className="text-muted-foreground px-6 py-16 text-center text-[15px]">
            {repos.length === 0
              ? "No repositories were opened during install. Add one below."
              : `No repositories match "${query}"`}
          </li>
        )}
      </ul>

      {/* "안 보여요" 두 케이스: 이 설치에 레포 더 열기 / 다른 org·계정에 App 설치. */}
      <div className="text-muted-foreground mt-4 space-y-1.5 font-mono text-[11px] tracking-wide">
        <p>
          Missing a repository?{" "}
          <a
            href={settingsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground underline underline-offset-4"
          >
            ADD ONE ON GITHUB ↗
          </a>
        </p>
        <p>
          Missing an organization?{" "}
          <a href="/api/github/install" className="text-foreground underline underline-offset-4">
            Add another organization ↗
          </a>
        </p>
      </div>
    </>
  );
}

function RepoRow({
  repo,
  projectRef,
  installationId,
}: {
  repo: InstallationRepo;
  projectRef?: string;
  installationId?: string;
}) {
  return (
    <li className="group hover:bg-muted/30 relative flex items-center gap-4 px-6 py-4 transition-colors duration-[180ms] ease-out">
      {/* 왼쪽 액센트 바. 세로로 펼쳐지며 들어온다 — CodeRabbit 활성 표시와 같은 장치.
          420ms expo-out 은 칸 확장용이고, 이런 작은 요소는 180ms 가 맞다. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-0.5 origin-center scale-y-0 bg-[#ff570a] transition-transform duration-[180ms] ease-out group-hover:scale-y-100 motion-reduce:transition-none"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[15px] font-medium">
          {repo.name}
          {repo.private && <Lock className="text-muted-foreground size-3 shrink-0" />}
        </p>
        <p className="text-muted-foreground mt-1 font-mono text-[11px] tracking-wide">
          {repo.language ?? "—"}
          {repo.pushedAt && ` · ${formatDistanceToNow(repo.pushedAt, { addSuffix: true })}`}
        </p>
      </div>

      {projectRef ? (
        <>
          <span className="text-brand-mint font-mono text-[10px] font-bold tracking-[0.12em]">
            CONNECTED
          </span>
          <Link
            href={`/project/${projectRef}/dashboard`}
            className={buttonVariants({ variant: "ghost", size: "sm", className: "rounded-[4px]" })}
          >
            Open
          </Link>
        </>
      ) : (
        // 서버 액션. 폼으로 보내야 CSRF 보호가 자동으로 걸리고 JS 없이도 동작한다.
        <form action={importRepo}>
          <input type="hidden" name="repoId" value={repo.id} />
          <input type="hidden" name="installationId" value={installationId ?? ""} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="rounded-[4px]"
            disabled={!installationId}
          >
            Import
          </Button>
        </form>
      )}
    </li>
  );
}
