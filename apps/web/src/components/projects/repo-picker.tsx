"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Lock, Search } from "lucide-react";
import { importRepo } from "@/app/projects/new/github/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InstallationRepo } from "@/lib/github/repos";

// 설치가 열어준 레포 목록.
//
// 행마다 Import 버튼을 둔다 (Vercel 방식). "선택 → 하단 버튼" 2단계보다 클릭이
// 하나 적고, 어떤 레포를 고른 상태인지 기억할 필요가 없다.
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
          // 높이·글자 크기는 Supabase 대시보드 실측(h26 / 12px)에 맞춘다
          className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-7 shrink-0 rounded-md border px-2 text-xs outline-none focus-visible:ring-3"
        >
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="레포 검색"
            className="h-7 rounded-md pl-7 text-xs md:text-xs"
          />
        </div>
      </div>

      <ul className="border-border divide-border mt-3 divide-y overflow-hidden rounded-lg border">
        {visible.map((repo) => (
          <RepoRow
            key={repo.id}
            repo={repo}
            projectRef={refByRepoId[String(repo.id)]}
            installationId={installationIdByRepoId[String(repo.id)]}
          />
        ))}
        {visible.length === 0 && (
          <li className="text-muted-foreground px-4 py-14 text-center text-[13px]">
            {repos.length === 0
              ? "설치할 때 레포를 고르지 않았습니다. 아래에서 레포를 추가하세요."
              : `"${query}" 와 일치하는 레포가 없습니다`}
          </li>
        )}
      </ul>

      {/* 처음 설치할 때 레포를 일부만 연 사용자가 되돌아갈 길. 없으면 막힌다. */}
      <p className="text-muted-foreground mt-3 text-center text-[13px]">
        찾는 레포가 없나요?{" "}
        <a
          href={settingsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground underline underline-offset-2"
        >
          GitHub 에서 레포 추가하기
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
    <li className="hover:bg-muted/40 flex items-center gap-3 px-4 py-2.5 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
          {repo.name}
          {repo.private && <Lock className="text-muted-foreground size-3 shrink-0" />}
        </p>
        <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
          {repo.language ?? "—"}
          {repo.pushedAt &&
            ` · ${formatDistanceToNow(repo.pushedAt, { addSuffix: true, locale: ko })}`}
        </p>
      </div>

      {projectRef ? (
        <>
          <Badge variant="outline" className="text-muted-foreground">
            연결됨
          </Badge>
          <Link
            href={`/project/${projectRef}/dashboard`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            열기
          </Link>
        </>
      ) : (
        // 서버 액션. 폼으로 보내야 CSRF 보호가 자동으로 걸리고 JS 없이도 동작한다.
        <form action={importRepo}>
          <input type="hidden" name="repoId" value={repo.id} />
          <input type="hidden" name="installationId" value={installationId ?? ""} />
          <Button type="submit" size="sm" disabled={!installationId}>
            Import
          </Button>
        </form>
      )}
    </li>
  );
}
