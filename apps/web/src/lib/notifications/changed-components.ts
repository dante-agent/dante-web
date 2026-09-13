import type { ComponentChange } from "./run-summary.ts";

// PR 에서 바뀐 파일 목록 → 바뀐 컴포넌트 목록. 순수 함수다.
//
// 지금은 경로만 본다. 파일 안을 읽어 export 를 세는 건 컴포넌트 추출(ts-morph)
// 단계의 일이고, 그게 붙으면 이 결과는 "읽어볼 파일 후보"로 좁아진다. 경로만으로도
// 먼저 해두는 이유는 README 만 고친 PR 을 걸러내는 데는 이걸로 충분해서다 —
// 그러면 "변경 없으면 코멘트 안 달기" 설정이 비로소 동작한다.

/** GitHub `GET /pulls/{n}/files` 한 줄에서 쓰는 필드만. */
export type PullRequestFile = {
  filename: string;
  /** added | removed | modified | renamed | copied | changed | unchanged */
  status: string;
};

// 컴포넌트는 JSX 를 쓰므로 .tsx/.jsx 만 본다. .ts 훅·유틸은 테스트 대상일 수는
// 있어도 "컴포넌트"는 아니다. 무시 목록은 lib/github/tree.ts 와 같은 판단이다.
const COMPONENT_EXT = /\.[jt]sx$/;
const NOT_COMPONENT = /(\.(test|spec|stories)\.[jt]sx$|(^|\/)__tests__\/)/;
const IGNORE = /(^|\/)(node_modules|dist|build|out|\.next|coverage|\.turbo|vendor)\//;

export function isComponentPath(path: string) {
  return COMPONENT_EXT.test(path) && !NOT_COMPONENT.test(path) && !IGNORE.test(path);
}

export function changedComponents(files: PullRequestFile[]): ComponentChange[] {
  const byPath = new Map<string, ComponentChange>();

  for (const file of files) {
    if (!isComponentPath(file.filename)) continue;

    const change = changeKind(file.status);
    if (!change) continue;

    byPath.set(file.filename, { name: componentName(file.filename), change, tests: 0 });
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
function changeKind(status: string): ComponentChange["change"] | null {
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
 * 표에 적을 이름. 파일 이름에서 확장자를 뗀다.
 *
 * `Sidebar/index.tsx` 처럼 폴더가 이름인 구조에서는 "index" 대신 폴더 이름을 쓴다.
 * 실제 export 이름은 추출 단계에서 채운다.
 */
function componentName(path: string) {
  const parts = path.split("/");
  const base = parts.at(-1)!.replace(COMPONENT_EXT, "");
  return base === "index" && parts.length > 1 ? parts.at(-2)! : base;
}
