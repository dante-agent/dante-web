"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { iconForFile } from "@/components/file-icons";
import { clearRecent, useRecent } from "@/lib/recent-files";

export function FolderEmptyState({ projectRef }: { projectRef: string }) {
  const recent = useRecent(projectRef);

  return (
    <div className="flex h-[calc(100svh-47px)] flex-col items-center gap-4 overflow-y-auto pt-[28%]">
      {/* 아이콘·문구는 상단에서 고정 거리 — 아래 Recent 유무·개수가 이들을 밀지 않는다 */}
      <FolderOpen className="text-brand-orange size-8" />
      <p className="text-sm font-medium">Select a file</p>

      {recent.length === 0 ? (
        <p className="text-muted-foreground text-xs">No recent files</p>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="border-border w-72 overflow-hidden rounded-md border">
            <div className="text-muted-foreground border-border border-b px-3 py-1.5 text-[11px] font-medium">
              Recently opened
            </div>
            <ul>
              {recent.map((path) => {
                const name = path.split("/").pop() ?? path;
                const dir = path.split("/").slice(0, -1).join("/");
                return (
                  <li key={path}>
                    <Link
                      href={`?file=${encodeURIComponent(path)}`}
                      className="hover:bg-muted flex items-center gap-2 px-3 py-1.5 text-xs"
                    >
                      {iconForFile(name, { className: "size-3.5 shrink-0" })}
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground truncate">{dir}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => clearRecent(projectRef)}
            className="text-muted-foreground hover:text-foreground self-end text-[10px]"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
