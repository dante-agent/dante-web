"use client";

// 본문(FileView)이 지금 연 파일의 테스트 코드를 AI 채팅(ai-chat.tsx)에 알리는 통로.
// ai-chat 에서 떼어 둔 이유: FileView 는 PR 화면에서도 쓰는데, 이 훅 하나 때문에 채팅 모듈
// 전체(react-markdown·remark-gfm·date-fns)가 PR 화면 번들에 딸려 왔다.

import { createContext, useContext, useEffect } from "react";

/**
 * 본문이 지금 연 파일의 테스트 코드를 알리는 통로(없으면 null). dock 밖(PR 화면)에서는 아무 일도 안 한다.
 * 유무뿐 아니라 내용까지 싣는 이유: 답의 코드가 이미 저장된 내용과 같으면 Apply 를 막아야 하는데,
 * 버튼의 "누름" 표시는 컴포넌트 state 라 새로고침·모드 전환에 초기화된다.
 */
export const CurrentTestContext = createContext<(test: string | null) => void>(() => {});

/** 본문(FileView)이 부른다. 채팅은 본문과 형제라 테스트를 따로 받아오지 않고 이렇게 전해 받는다. */
export function useReportCurrentTest(test: string | null) {
  const report = useContext(CurrentTestContext);
  useEffect(() => report(test), [report, test]);
}
