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
  // 문법 진단까지 끄는 건 JSX 때문이다: 모델에 경로(.tsx)가 없어 TS 가 .ts 로 보고
  // 모든 JSX 태그에 빨간 물결을 친다. 경로를 주면 Before|After 가 모델을 공유해 깨진다.
  const diag = {
    noSemanticValidation: true,
    noSuggestionDiagnostics: true,
    noSyntaxValidation: true,
  };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diag);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diag);
};
