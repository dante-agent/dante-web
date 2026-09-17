// 테스트를 만들 대상인 소스 파일인지. 순수 함수다.
//
// 레포 트리(lib/github/tree.ts)는 확장자로만 소스를 고른다. 그러면 도구 설정 파일과 테스트 준비
// 파일도 "테스트 없는 소스"가 되어 추천에 올라온다. 이 파일들은 앱 동작이 아니라 빌드·린트·테스트
// 도구를 설정할 뿐이라 단위 테스트를 만들 대상이 아니다.
//
// 트리 자체에서 빼지 않는 이유: 폴더 보기에서는 여전히 열어 볼 수 있어야 한다.

const NOT_A_TEST_TARGET = new RegExp(
  [
    // 도구 설정: eslint.config.js · vite.config.ts · vitest.config.e2e.mts · next.config.mjs
    String.raw`[\w-]+\.config(\.[\w-]+)?\.[cm]?[jt]s`,
    // rc 파일: .eslintrc.js · .prettierrc.cjs · .babelrc.js
    String.raw`\.[\w-]+rc\.[cm]?[jt]s`,
    // 테스트 준비: vitest.setup.ts · jest.setup.js · setupTests.ts
    String.raw`(vitest|jest)\.setup\.[cm]?[jt]sx?`,
    String.raw`setupTests\.[cm]?[jt]sx?`,
  ]
    .map((pattern) => `(^|/)${pattern}$`)
    .join("|")
);

export function isTestTarget(path: string): boolean {
  return !NOT_A_TEST_TARGET.test(path);
}
