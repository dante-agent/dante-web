// Monaco 테마·초기 설정. 파일 보기(file-view)와 채팅 코드블록 색칠(chat-markdown)이 같은 값을 쓴다
// — 에디터와 채팅 코드의 색이 어긋나지 않게 한 곳에 둔다.

import type { Monaco } from "@monaco-editor/react";

export const MONACO_THEME = "dante-black";

export const setupMonaco = (monaco: Monaco) => {
  monaco.editor.defineTheme(MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#000000",
      "editorGutter.background": "#000000",
      "editorLineNumber.background": "#000000",
      "diffEditor.insertedLineBackground": "#132a1c",
      "diffEditor.removedLineBackground": "#331a1c",
      "diffEditor.insertedTextBackground": "#2ea04340",
      "diffEditor.removedTextBackground": "#f8514940",
      "diffEditor.border": "#00000000",
    },
  });
  // 목업 코드 뷰어 — 미설치 모듈("vitest" 등) 진단 안 띄운다.
  // 문법 진단은 켜 둔다: 오타(`cosnt`, 닫히지 않은 괄호)는 보여야 한다.
  // 예전에 이것까지 껐던 건 JSX 때문이었는데, 이제 에디터마다 .tsx 경로를 주므로
  // TS 가 JSX 를 정상으로 읽는다(file-view 의 modelPath).
  const diag = { noSemanticValidation: true, noSuggestionDiagnostics: true };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diag);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diag);

  // 경로가 .tsx 여도 jsx 옵션이 없으면 TS 가 JSX 를 거부한다. 기본값을 통째로 덮어쓰므로
  // 원래 있던 allowNonTsExtensions·target 도 같이 적는다.
  const compilerOptions = {
    jsx: monaco.languages.typescript.JsxEmit.React,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
  };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
};
