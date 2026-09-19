// 채팅 컨텍스트에 붙일 "열어 둔 파일이 import 한 레포 파일들".
//
// 왜 필요한가: 모델은 열어 둔 소스와 그 테스트만 본다. 그 파일이 쓰는 헬퍼의 시그니처도,
// 컴포넌트의 props 타입도 볼 방법이 없어서 지어냈다. 지어낸 게 틀리면 테스트가 아예 안 돈다.
//
// 모델에게 도구로 읽게 하지 않고 우리가 붙이는 이유: 경로를 추측시킬 필요가 없다.
// parseImports + createResolver 가 tsconfig 별칭까지 풀어 레포의 실제 경로를 준다
// (추천 점수가 쓰던 것과 같은 함수다). 모델 호출도 늘지 않는다.

import { getFileText } from "@/lib/github/blob";
import { getRepoTree, getRepoTreeMeta } from "@/lib/github/tree";
import { createResolver, parseImports } from "@/lib/projects/code-analysis";
import type { ProjectRepo } from "@/lib/projects/queries";

/** tsconfig 파일 이름. 레포 트리는 소스만 담으므로 blob 크기 맵에서 찾는다. */
const TSCONFIG_RE = /(^|\/)tsconfig(\.[\w-]+)?\.json$/;

/**
 * 붙이는 파일 본문 합계 상한(글자). 개수가 아니라 글자로 막는다 — 우리가 내는 건 토큰 값이고,
 * 작은 파일 20개보다 큰 파일 2개가 비싸다. 한 대화 예산(5만 토큰)의 1/7 쯤이다.
 */
const MAX_TOTAL_CHARS = 25_000;

/** 이 파일에 영향을 주는 tsconfig 후보. 자기 폴더부터 루트까지 거슬러 올라간 것만. */
function tsconfigPathsFor(file: string, blobs: Iterable<string>): string[] {
  const dirs = new Set<string>([""]);
  const parts = file.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  return (
    [...blobs]
      .filter((path) => {
        if (!TSCONFIG_RE.test(path)) return false;
        const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        return dirs.has(dir);
      })
      // 깊은 것부터 — createResolver 가 가장 가까운 tsconfig 를 먼저 본다.
      .sort((a, b) => b.length - a.length)
  );
}

export type ImportedFiles = {
  /** 경로 → 본문. 붙일 파일들. */
  files: Map<string, string>;
  /** 너무 커서 못 붙인 파일. 모델에게 알려 "모른다"고 말할 수 있게 한다. */
  skipped: string[];
};

/**
 * 열어 둔 소스가 import 한 레포 파일들을 읽는다. 외부 패키지(react 등)는 레포에 그런 파일이
 * 없으니 저절로 빠진다 — 별도 목록을 두지 않는다.
 *
 * 예산을 넘는 파일은 건너뛰고 다음 파일을 계속 본다. 거기서 멈추면 큰 파일 하나 때문에
 * 뒤의 작은 파일들까지 날아간다.
 */
export async function loadImportedFiles(
  repo: ProjectRepo,
  file: string,
  source: string
): Promise<ImportedFiles> {
  const specs = parseImports(source);
  if (specs.length === 0) return { files: new Map(), skipped: [] };

  const [entries, meta] = await Promise.all([getRepoTree(repo), getRepoTreeMeta(repo)]);
  const paths = new Set(entries.map((e) => e.path));

  const tsconfigs = new Map<string, string>();
  await Promise.all(
    tsconfigPathsFor(file, meta.sizes.keys()).map(async (path) => {
      const text = await getFileText(repo, path);
      if (text !== null) tsconfigs.set(path, text);
    })
  );

  const resolve = createResolver(paths, tsconfigs);
  const wanted: string[] = [];
  for (const spec of specs) {
    const hit = resolve(file, spec);
    // 자기 자신은 이미 컨텍스트에 있다.
    if (hit && hit !== file && !wanted.includes(hit)) wanted.push(hit);
  }

  const files = new Map<string, string>();
  const skipped: string[] = [];
  let left = MAX_TOTAL_CHARS;
  // import 순서대로 본다. 소스가 먼저 쓴 것이 대개 더 중요하다.
  const texts = await Promise.all(wanted.map((path) => getFileText(repo, path)));
  wanted.forEach((path, i) => {
    const text = texts[i];
    if (text === null) return;
    if (text.length > left) {
      skipped.push(path);
      return;
    }
    left -= text.length;
    files.set(path, text);
  });
  return { files, skipped };
}
