"use client";

// 폴더 보기 서브 사이드바의 파일 트리.
// - 소스 파일만 잎. 우측 상태 점: ● 테스트 파일 있음 / ○ 없음
// - 단일 자식 디렉터리 체인은 buildTree 에서 접힘
// - 파일 클릭 → `?file=<path>` 로 라우팅 (선택 상태는 URL 이 들고 있음)
// - 상단: 상태 필터(전체/없음/있음)
// entries 는 folder/layout 이 getRepoTree 로 넘겨준다.

import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buildTree, type FileEntry, type TreeNode } from "@/lib/file-tree";
import { iconForFile } from "@/components/file-icons";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "untested" | "tested";

const FILTERS: { key: StatusFilter; label: string; title: string }[] = [
  { key: "all", label: "All", title: "All files" },
  { key: "untested", label: "Untested", title: "Files without tests" },
  { key: "tested", label: "Tested", title: "Files with tests" },
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

/**
 * 트리의 선택·펼침 상태. React state 대신 작은 store 에 두고 노드가 자기 불리언만 구독한다
 * (useSyncExternalStore). 파일을 고르면 이전·새 선택 잎 둘만, 폴더를 열고 닫으면 그 폴더만
 * 다시 그린다 — state 를 위에서 props 로 내리면 파일 하나 고를 때마다 트리 전체가 다시 그려진다.
 */
type TreeStore = {
  subscribe: (listener: () => void) => () => void;
  isSelected: (path: string) => boolean;
  isOpen: (path: string) => boolean;
  setSelected: (path: string | null) => void;
  toggle: (path: string) => void;
  openFile: (path: string) => void;
  /** 클릭 때 쓸 이동 함수. URL 이 바뀔 때마다 FileTree 가 새로 넣는다(노드는 다시 안 그린다). */
  setOpenFile: (openFile: (path: string) => void) => void;
};

function createTreeStore(selected: string | null, expanded: Set<string>): TreeStore {
  let openFile: (path: string) => void = () => {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isSelected: (path) => selected === path,
    isOpen: (path) => expanded.has(path),
    setSelected: (path) => {
      if (path === selected) return;
      selected = path;
      notify();
    },
    toggle: (path) => {
      expanded = new Set(expanded);
      if (expanded.has(path)) expanded.delete(path);
      else expanded.add(path);
      notify();
    },
    openFile: (path) => openFile(path),
    setOpenFile: (next) => {
      openFile = next;
    },
  };
}

const TreeStoreContext = createContext<TreeStore | null>(null);

function useTreeStore(): TreeStore {
  const store = useContext(TreeStoreContext);
  if (!store) throw new Error("FileTree 노드는 FileTree 안에서만 그린다.");
  return store;
}

export function FileTree({ entries }: { entries: FileEntry[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("file");

  const [filter, setFilter] = useState<StatusFilter>("all");

  const fullTree = useMemo(() => buildTree(entries), [entries]);

  const [store] = useState(() => createTreeStore(selected, new Set(collectDirPaths(fullTree))));
  // 선택은 URL 이 들고 있다. 바뀌면 store 에 알려 해당 잎만 다시 그리게 한다(칠하기 전에).
  useLayoutEffect(() => store.setSelected(selected), [store, selected]);
  // 클릭하면 지금 URL 의 다른 파라미터(mode 등)는 두고 file 만 바꾼다.
  useLayoutEffect(
    () =>
      store.setOpenFile((filePath) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("file", filePath);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }),
    [store, pathname, router, searchParams]
  );

  const tree = useMemo(() => {
    if (filter === "all") return fullTree;
    return filterTree(fullTree, (leaf) => matchesStatus(leaf.status, filter));
  }, [fullTree, filter]);

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
          <li className="text-muted-foreground px-2 py-6 text-center text-xs">No matching files</li>
        ) : (
          <TreeStoreContext value={store}>
            {tree.map((node) => (
              <Node key={node.path} node={node} depth={0} />
            ))}
          </TreeStoreContext>
        )}
      </ul>
    </div>
  );
}

/** props 는 노드와 깊이뿐이라 memo 가 걸린다. 선택·펼침은 store 에서 자기 것만 읽는다. */
const Node = memo(function Node({ node, depth }: { node: TreeNode; depth: number }) {
  return node.type === "dir" ? (
    <DirRow node={node} depth={depth} />
  ) : (
    <FileRow node={node} depth={depth} />
  );
});

const rowPadding = (depth: number) => ({ paddingLeft: `${depth * 12 + 8}px` });

function DirRow({ node, depth }: { node: Extract<TreeNode, { type: "dir" }>; depth: number }) {
  const store = useTreeStore();
  const opened = useSyncExternalStore(
    store.subscribe,
    () => store.isOpen(node.path),
    () => store.isOpen(node.path)
  );
  return (
    <li>
      <button
        type="button"
        onClick={() => store.toggle(node.path)}
        style={rowPadding(depth)}
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
            <Node key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FileRow({ node, depth }: { node: Extract<TreeNode, { type: "file" }>; depth: number }) {
  const store = useTreeStore();
  const active = useSyncExternalStore(
    store.subscribe,
    () => store.isSelected(node.path),
    () => store.isSelected(node.path)
  );
  return (
    <li>
      <button
        type="button"
        onClick={() => store.openFile(node.path)}
        style={rowPadding(depth)}
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
      aria-label={status === "has" ? "Has tests" : "No tests"}
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
