"use client";

// 폴더 보기 서브 사이드바의 파일 트리.
// - 소스 파일만 잎. 우측 상태 점: ● 테스트 파일 있음 / ○ 없음
// - 단일 자식 디렉터리 체인은 buildTree 에서 접힘
// - 파일 클릭 → `?file=<path>` 로 라우팅 (선택 상태는 URL 이 들고 있음)
// - 상단: 상태 필터(전체/없음/있음)
// entries 는 folder/layout 이 getRepoTree 로 넘겨준다.

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buildTree, type FileEntry, type TreeNode } from "@/lib/file-tree";
import { iconForFile } from "@/components/file-icons";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "untested" | "tested";

const FILTERS: { key: StatusFilter; label: string; title: string }[] = [
  { key: "all", label: "All", title: "전체 파일" },
  { key: "untested", label: "Untested", title: "테스트 없는 파일" },
  { key: "tested", label: "Tested", title: "테스트 있는 파일" },
];

function matchesStatus(status: FileEntry["status"], filter: StatusFilter): boolean {
  if (filter === "all") return true;
  return filter === "untested" ? status === "none" : status === "has";
}

/** 파일 predicate 로 트리를 걸러낸다. 매칭 자식이 하나도 없는 디렉터리는 버린다. */
function filterTree(
  nodes: TreeNode[],
  keep: (leaf: Extract<TreeNode, { type: "file" }>) => boolean
): TreeNode[] {
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (keep(node)) out.push(node);
    } else {
      const children = filterTree(node.children, keep);
      if (children.length) out.push({ ...node, children });
    }
  }
  return out;
}

function collectDirPaths(nodes: TreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === "dir") {
      acc.push(node.path);
      collectDirPaths(node.children, acc);
    }
  }
  return acc;
}

export function FileTree({ entries }: { entries: FileEntry[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("file");

  const [filter, setFilter] = useState<StatusFilter>("all");

  const fullTree = useMemo(() => buildTree(entries), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(collectDirPaths(fullTree)));

  const tree = useMemo(() => {
    if (filter === "all") return fullTree;
    return filterTree(fullTree, (leaf) => matchesStatus(leaf.status, filter));
  }, [fullTree, filter]);

  const isOpen = (path: string) => expanded.has(path);
  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const open = (filePath: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("file", filePath);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* 접기 버튼(SubSidebar absolute top-2 right-1)·메인 레일 아이템과 같은 선. pr-12 로 겹침 회피 */}
      <div className="-mt-1 flex h-9 items-center gap-1 pr-12">
        {FILTERS.map(({ key, label, title }) => (
          <button
            key={key}
            type="button"
            title={title}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-xs transition-colors",
              filter === key
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-muted-foreground hover:text-sidebar-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="-mx-1 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {tree.length === 0 ? (
          <li className="text-muted-foreground px-2 py-6 text-center text-xs">
            일치하는 파일 없음
          </li>
        ) : (
          tree.map((node) => (
            <Node
              key={node.path}
              node={node}
              depth={0}
              selected={selected}
              isOpen={isOpen}
              toggle={toggle}
              onOpenFile={open}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function Node({
  node,
  depth,
  selected,
  isOpen,
  toggle,
  onOpenFile,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  isOpen: (path: string) => boolean;
  toggle: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const pad = { paddingLeft: `${depth * 12 + 8}px` };

  if (node.type === "dir") {
    const opened = isOpen(node.path);
    return (
      <li>
        <button
          type="button"
          onClick={() => toggle(node.path)}
          style={pad}
          className="text-sidebar-foreground/80 hover:bg-sidebar-accent/60 flex h-7 w-full items-center gap-1 rounded-md pr-2 text-sm"
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 transition-transform", opened && "rotate-90")}
          />
          <span className="min-w-0 truncate">{node.name}</span>
        </button>
        {opened && (
          <ul>
            {node.children.map((child) => (
              <Node
                key={child.path}
                node={child}
                depth={depth + 1}
                selected={selected}
                isOpen={isOpen}
                toggle={toggle}
                onOpenFile={onOpenFile}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const active = selected === node.path;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenFile(node.path)}
        style={pad}
        className={cn(
          "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-sm",
          active
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
        )}
      >
        {iconForFile(node.name, { className: "size-3.5 shrink-0" })}
        <span className="min-w-0 truncate">{node.name}</span>
        <StatusDot status={node.status} />
      </button>
    </li>
  );
}

// size-3 박스에 중앙 정렬 → ml-auto 로 접기 버튼 아이콘과 오른쪽 끝이 맞는다.
function StatusDot({ status }: { status: FileEntry["status"] }) {
  return (
    <span
      aria-label={status === "has" ? "테스트 있음" : "테스트 없음"}
      className="ml-auto flex size-3 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "has" ? "bg-brand-mint" : "border-muted-foreground border"
        )}
      />
    </span>
  );
}
