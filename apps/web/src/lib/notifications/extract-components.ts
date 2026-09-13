import { Node, Project, SyntaxKind, ts } from "ts-morph";

// 파일 하나의 소스 → 그 파일이 export 하는 컴포넌트. 순수 함수다.
//
// 타입 검사는 하지 않고 구문만 본다. 판단 기준은 두 가지다.
//   1. export 이름이 대문자로 시작하거나 default export 다 (React 규칙과 같다)
//   2. 선언 안에 JSX 가 있다
//
// 그래서 JSX 없이 createElement 만 쓰거나 null 만 돌려주는 컴포넌트는 놓친다.
// 반대로 JSX 를 돌려주는 대문자 유틸도 컴포넌트로 센다. 테스트를 만들 후보를
// 고르는 용도라 조금 넓게 잡는 쪽이 낫다.

export type ExtractedComponent = {
  /** export 이름. default export 는 "default". Component.exportName 과 같은 규칙 */
  exportName: string;
  /** 선언 이름. 이름 없는 default export 면 null 이고, 호출부가 파일 이름으로 채운다 */
  name: string | null;
};

const JSX_KINDS = [SyntaxKind.JsxElement, SyntaxKind.JsxSelfClosingElement, SyntaxKind.JsxFragment];

export function extractComponents(filePath: string, source: string): ExtractedComponent[] {
  // 디스크를 건드리지 않는다. 다른 파일을 찾아 읽지도 않으므로 `export { A } from "./A"`
  // 같은 재수출은 선언을 못 찾아 빠진다 — 그 파일이 바뀌었으면 그쪽에서 잡힌다.
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, allowJs: true },
  });
  const file = project.createSourceFile(filePath, source);

  const components: ExtractedComponent[] = [];

  for (const [exportName, declarations] of file.getExportedDeclarations()) {
    if (exportName !== "default" && !/^[A-Z]/.test(exportName)) continue;

    const declaration = declarations[0];
    if (!declaration || !containsJsx(declaration)) continue;

    components.push({ exportName, name: declarationName(declaration) });
  }

  return components;
}

function containsJsx(node: Node) {
  if (JSX_KINDS.includes(node.getKind())) return true;
  return JSX_KINDS.some((kind) => node.getFirstDescendantByKind(kind) !== undefined);
}

function declarationName(node: Node) {
  if (Node.isFunctionDeclaration(node) || Node.isClassDeclaration(node)) {
    return node.getName() ?? null;
  }
  if (Node.isVariableDeclaration(node)) return node.getName();
  return null;
}
