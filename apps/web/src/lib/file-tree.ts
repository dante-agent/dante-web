// flat 경로 리스트 → 중첩 트리. GitHub `git/trees?recursive=1` 응답(=blob 경로 배열)을
// 그대로 먹을 수 있게 입력을 { path, status } 배열로 잡았다. 실데이터 붙어도 이 함수는 유지된다.
//
// 트리엔 소스 파일만 잎으로 둔다. `*.test.ts` 는 별도 행이 아니라 소스의 status 로만 표현
// (has = 테스트 파일 있음 / none = 없음).

export type FileStatus = "has" | "none";

export type FileLeaf = {
  type: "file";
  name: string;
  /** 레포 루트 기준 전체 경로. 선택 상태(`?file=`)의 키. */
  path: string;
  status: FileStatus;
};

export type DirNode = {
  type: "dir";
  /** 표시용 이름. 단일 자식 디렉터리 체인은 "features/checkout/steps" 처럼 합쳐진다. */
  name: string;
  path: string;
  children: TreeNode[];
};

export type TreeNode = DirNode | FileLeaf;

export type FileEntry = { path: string; status: FileStatus };

/** 디렉터리 먼저, 그 안에서 이름 오름차순. 재귀. */
function sortNodes(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.type === "dir") sortNodes(node.children);
  }
  return nodes;
}

/** 자식이 디렉터리 하나뿐인 디렉터리는 그 자식과 합친다 (src/app/(main) 같은 깊은 중첩 완화). */
function collapse(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.type !== "dir") return node;
    let dir = node;
    while (dir.children.length === 1 && dir.children[0].type === "dir") {
      const child = dir.children[0];
      dir = {
        type: "dir",
        name: `${dir.name}/${child.name}`,
        path: child.path,
        children: child.children,
      };
    }
    return { ...dir, children: collapse(dir.children) };
  });
}

export function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: DirNode = { type: "dir", name: "", path: "", children: [] };

  for (const { path, status } of entries) {
    const parts = path.split("/");
    let dir = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      const dirPath = parts.slice(0, i + 1).join("/");
      let next = dir.children.find((c): c is DirNode => c.type === "dir" && c.name === name);
      if (!next) {
        next = { type: "dir", name, path: dirPath, children: [] };
        dir.children.push(next);
      }
      dir = next;
    }

    dir.children.push({ type: "file", name: parts[parts.length - 1], path, status });
  }

  return sortNodes(collapse(root.children));
}
