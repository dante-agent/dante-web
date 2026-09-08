"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MockRepo } from "@/lib/mock-data";

// 2단계. 설치된 GitHub App 이 볼 수 있는 레포 목록.
//
// 행마다 Import 버튼을 둔다 (Vercel 방식). "선택 → 하단 버튼" 2단계보다 클릭이 하나 적고,
// 어떤 레포를 고른 상태인지 기억할 필요가 없다.
export function RepoPicker({ repos, owners }: { repos: MockRepo[]; owners: string[] }) {
  const [owner, setOwner] = useState(owners[0] ?? "");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return repos.filter(
      (repo) => repo.owner === owner && (!needle || repo.name.toLowerCase().includes(needle))
    );
  }, [repos, owner, query]);

  return (
    <>
      <div className="flex gap-2">
        {/* shadcn Select 대신 네이티브 <select>. 목록이 짧고 검색이 필요 없어서
            컴포넌트를 하나 더 들이는 것보다 이쪽이 가볍다. 필요해지면 교체한다. */}
        <select
          aria-label="계정"
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 shrink-0 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
        >
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="레포 검색"
            className="pl-8"
          />
        </div>
      </div>

      <ul className="border-border mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-xl border">
        {visible.map((repo) => (
          <RepoRow key={repo.id} repo={repo} />
        ))}
        {visible.length === 0 && (
          <li className="text-muted-foreground px-4 py-14 text-center text-sm">
            &quot;{query}&quot; 와 일치하는 레포가 없습니다
          </li>
        )}
      </ul>

      {/* 처음 설치할 때 레포 하나만 고른 사용자가 되돌아갈 길. 이 링크가 없으면 막힌다. */}
      <p className="text-muted-foreground mt-4 text-center text-sm">
        찾는 레포가 없나요?{" "}
        {/* TODO(다음 PR): href → github.com/settings/installations/<installation_id> */}
        <span className="text-foreground underline underline-offset-2">
          GitHub 에서 레포 추가하기
        </span>
      </p>
    </>
  );
}

function RepoRow({ repo }: { repo: MockRepo }) {
  return (
    <li className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {repo.name}
          {repo.private && <Lock className="text-muted-foreground size-3 shrink-0" />}
        </p>
        <p className="text-muted-foreground mt-0.5 font-mono text-xs">
          {repo.language ?? "—"} ·{" "}
          {formatDistanceToNow(repo.pushedAt, { addSuffix: true, locale: ko })}
        </p>
      </div>

      {repo.importedAs ? (
        <>
          <Badge variant="outline" className="text-muted-foreground">
            연결됨
          </Badge>
          <Link
            href={`/project/${repo.importedAs}/dashboard`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            열기
          </Link>
        </>
      ) : (
        // TODO(다음 PR): Project 생성 서버 액션 → redirect(`/project/<ref>/dashboard`)
        <Button size="sm" disabled>
          Import
        </Button>
      )}
    </li>
  );
}
