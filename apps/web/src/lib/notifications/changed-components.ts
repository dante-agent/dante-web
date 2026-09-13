import type { ComponentChange } from "./run-summary.ts";

// PR 에서 바뀐 파일 목록 → 컴포넌트가 들어 있을 만한 파일. 순수 함수다.
//
// 경로만 본다. 파일 안을 읽어 실제로 컴포넌트를 export 하는지는
// extract-components.ts 가 가린다. 두 단계로 나눈 이유는 비용이다 — README 만
// 고친 PR 은 파일 내용을 한 번도 받아오지 않고 여기서 끝난다.

/** GitHub `GET /pulls/{n}/files` 한 줄에서 쓰는 필드만. */
export type PullRequestFile = {
  filename: string;
  /** added | removed | modified | renamed | copied | changed | unchanged */
  status: string;
};

export type ChangedFile = {
  filePath: string;
  change: ComponentChange["change"];
};

// 컴포넌트는 JSX 를 쓰므로 .tsx/.jsx 만 본다. .ts 훅·유틸은 테스트 대상일 수는
// 있어도 "컴포넌트"는 아니다. 무시 목록은 lib/github/tree.ts 와 같은 판단이다.
const COMPONENT_EXT = /\.[jt]sx$/;
const NOT_COMPONENT = /(\.(test|spec|stories)\.[jt]sx$|(^|\/)__tests__\/)/;
const IGNORE = /(^|\/)(node_modules|dist|build|out|\.next|coverage|\.turbo|vendor)\//;

export function isComponentPath(path: string) {
  return COMPONENT_EXT.test(path) && !NOT_COMPONENT.test(path) && !IGNORE.test(path);
}

export function changedComponentFiles(files: PullRequestFile[]): ChangedFile[] {
  const byPath = new Map<string, ChangedFile>();

  for (const file of files) {
    if (!isComponentPath(file.filename)) continue;

    const change = changeKind(file.status);
    if (!change) continue;

    byPath.set(file.filename, { filePath: file.filename, change });
  }

  return [...byPath.values()];
}

/**
 * GitHub 의 파일 상태 → 코멘트 표의 세 가지.
 *
 * renamed 는 changed 로 접는다. 이름만 바뀌어도 import 경로가 달라져 기존 테스트가
 * 깨질 수 있으니 다시 볼 대상이다. unchanged 는 커밋 범위 밖에서 모드만 바뀐
 * 경우라 할 일이 없다.
 */
function changeKind(status: string): ChangedFile["change"] | null {
  switch (status) {
    case "added":
    case "copied":
      return "added";
    case "removed":
      return "removed";
    case "modified":
    case "renamed":
    case "changed":
      return "changed";
    default:
      return null;
  }
}

/**
 * 파일 경로에서 뽑은 이름. 확장자를 뗀다.
 *
 * export 이름을 모를 때(지워진 파일, 내용을 못 읽은 파일, 이름 없는 default
 * export) 쓴다. `Sidebar/index.tsx` 처럼 폴더가 이름인 구조에서는 폴더 이름을 쓴다.
 */
export function fileComponentName(path: string) {
  const parts = path.split("/");
  const base = parts.at(-1)!.replace(COMPONENT_EXT, "");
  return base === "index" && parts.length > 1 ? parts.at(-2)! : base;
}
