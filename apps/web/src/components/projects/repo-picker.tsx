"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Lock, Search } from "lucide-react";
import { importRepo } from "@/app/projects/new/github/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        {/* shadcn Select 대신 네이티브 <select>. 계정 수가 적고 검색이 필요 없어서
            컴포넌트를 하나 더 들이는 것보다 가볍다. 늘어나면 교체한다. */}
        <select
          aria-label="계정"
          value={activeOwner}
          onChange={(event) => setOwner(event.target.value)}
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-9 shrink-0 rounded-[4px] border px-3 font-mono text-xs outline-none focus-visible:ring-2"
        >
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="레포 검색"
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
              ? "설치할 때 레포를 고르지 않았습니다. 아래에서 레포를 추가하세요."
              : `"${query}" 와 일치하는 레포가 없습니다`}
          </li>
        )}
      </ul>

      {/* 처음 설치할 때 레포를 일부만 연 사용자가 되돌아갈 길. 없으면 막힌다. */}
      <p className="text-muted-foreground mt-4 font-mono text-[11px] tracking-wide">
        찾는 레포가 없나요?{" "}
        <a
          href={settingsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground underline underline-offset-4"
        >
          GITHUB 에서 레포 추가하기 ↗
        </a>
      </p>
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
    <li className="hover:bg-muted/30 flex items-center gap-4 px-6 py-4 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[15px] font-medium">
          {repo.name}
          {repo.private && <Lock className="text-muted-foreground size-3 shrink-0" />}
        </p>
        <p className="text-muted-foreground mt-1 font-mono text-[11px] tracking-wide">
          {repo.language ?? "—"}
          {repo.pushedAt &&
            ` · ${formatDistanceToNow(repo.pushedAt, { addSuffix: true, locale: ko })}`}
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
            열기
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
