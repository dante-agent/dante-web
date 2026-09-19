"use client";

// 최상단 헤더의 파일 검색. 포커스 시 Recent(최근 연 파일) → 타이핑하면 매칭 목록.
// ↑↓ 이동 · Enter 열기 · Esc 닫기. 선택 시 폴더 뷰로 이동.
// 스크린리더용으로 APG 콤보박스 패턴을 따른다: 포커스는 input 에 두고 aria-activedescendant 로
// 고른 항목을 가리킨다. 결과 수는 늘 렌더되는 sr-only status 로 알린다.

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { iconForFile } from "@/components/file-icons";
import { Input } from "@/components/ui/input";
import { useRecent } from "@/lib/recent-files";
import { cn } from "@/lib/utils";

// ponytail: substring 매칭. 조각/이니셜 검색 필요하면 fuzzy(subsequence + 점수)로 교체 — 이 함수만.
function matchFiles(files: string[], q: string): string[] {
  const needle = q.toLowerCase();
  return files
    .map((path) => {
      const p = path.toLowerCase();
      const name = p.slice(p.lastIndexOf("/") + 1);
      const at = p.indexOf(needle);
      if (at === -1) return null;
      const score = (name.includes(needle) ? 0 : 1000) + at + path.length / 100;
      return { path, score };
    })
    .filter((x): x is { path: string; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map((x) => x.path);
}

export function FileSearch({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const recent = useRecent(projectRef);
  const listId = useId();

  // 레포 파일 목록은 검색창을 처음 열 때 받는다 — 프로젝트 페이지마다 GitHub 트리를 치지 않으려고
  // 레이아웃이 아니라 여기서 가져온다. 캐시에 남아 두 번째부터는 즉시 뜬다.
  const [touched, setTouched] = useState(false);
  const { data: files = [] } = useQuery({
    queryKey: ["project", "files", projectRef],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectRef}/files`);
      if (!response.ok) return [] as string[];
      const body = (await response.json()) as { files: string[] };
      return body.files;
    },
    enabled: touched,
    staleTime: 5 * 60_000,
  });

  const showRecent = query.trim() === "";
  const results = useMemo(
    () => (showRecent ? recent : matchFiles(files, query.trim())),
    [showRecent, recent, files, query]
  );

  const go = (path: string) => {
    router.push(`/project/${projectRef}/folder?file=${encodeURIComponent(path)}`);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const expanded = open && results.length > 0;
  const optionId = (i: number) => `${listId}-${i}`;
  // 입력 중일 때만 알린다. 포커스만 한 순간(Recent)까지 읽으면 시끄럽다.
  const announcement =
    open && !showRecent
      ? results.length === 0
        ? "No matching files"
        : `${results.length} ${results.length === 1 ? "file" : "files"} found`
      : "";

  return (
    <div className="relative w-full">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onFocus={() => {
          setOpen(true);
          setTouched(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Search files…"
        aria-label="Search files"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? optionId(active) : undefined}
        className="h-7 pl-8 text-xs focus-visible:ring-0 md:text-xs"
      />

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {expanded && (
        // mousedown 기본동작 막아 input blur 전에 클릭이 먹도록
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="border-border bg-popover absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md"
        >
          {showRecent && (
            <div className="text-muted-foreground border-border border-b px-3 py-1.5 text-[11px] font-medium">
              Recent
            </div>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-label={showRecent ? "Recent files" : "Matching files"}
          >
            {results.map((path, i) => {
              const name = path.split("/").pop() ?? path;
              const dir = path.split("/").slice(0, -1).join("/");
              return (
                // 옵션은 포커스를 받지 않는다(포커스는 input 에 남는다). 클릭은 li 가 직접 받는다.
                <li
                  key={path}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(path)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs",
                    i === active && "bg-muted"
                  )}
                >
                  {iconForFile(name, { className: "size-3.5 shrink-0" })}
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground truncate">{dir}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
