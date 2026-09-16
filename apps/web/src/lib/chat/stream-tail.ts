// AI 채팅 답 스트림의 꼬리 형식. 서버(api/chat/route.ts)가 붙이고 화면(ai-chat.tsx)이 뗀다.
//
// 헤더는 본문보다 먼저 나가서 끝나야 아는 값(토큰 수·저장 여부·채팅이 한 일)을 실을 수 없다.
// 그래서 답 끝에 구분자로 붙인다. 구분자는 모델 답에 나올 일 없는 제어문자(RS).
//
//   <답> RS <컨텍스트 토큰 수 | 빈칸> RS <"unsaved" | 빈칸> RS <actions JSON>

const MARK = "\u001e";
const UNSAVED = "unsaved";

/** 이번 답에서 채팅 도구가 한 일. 화면이 Test Code 를 다시 읽고, 실행을 터미널에서 시작한다. */
export type ChatActions = {
  /** 테스트를 새 버전으로 저장했는지. */
  edited: boolean;
  /** 돌릴 테스트 버전. 실행 요청이 없었으면 null. */
  runVersionId: string | null;
};

export type StreamTail = {
  /** 이번 턴의 컨텍스트 토큰. 못 받았으면 null — 화면은 이전 값을 둔다. */
  contextTokens: number | null;
  /** 대화에 저장됐는지. false 면 화면이 "저장 안 됨"을 알리고 이 턴을 대화에 붙이지 않는다. */
  saved: boolean;
  actions: ChatActions;
};

export const NO_ACTIONS: ChatActions = { edited: false, runVersionId: null };

export function encodeTail(tail: StreamTail): string {
  return (
    MARK +
    (tail.contextTokens ?? "") +
    MARK +
    (tail.saved ? "" : UNSAVED) +
    MARK +
    JSON.stringify(tail.actions)
  );
}

/**
 * 받은 만큼의 원문 → 화면에 보일 답 + 꼬리. 꼬리가 아직 안 왔으면(스트리밍 중) tail 은 null.
 * 꼬리 JSON 은 우리 서버가 만든 값이지만 모양은 다시 본다 — 깨졌으면 아무 일도 하지 않는다.
 */
export function splitStream(raw: string): { answer: string; tail: StreamTail | null } {
  const [answer, tokens, flag, actionsJson] = raw.split(MARK);
  if (actionsJson === undefined) return { answer, tail: null };

  let actions = NO_ACTIONS;
  try {
    const parsed: unknown = JSON.parse(actionsJson);
    if (parsed && typeof parsed === "object") {
      const { edited, runVersionId } = parsed as Record<string, unknown>;
      actions = {
        edited: edited === true,
        runVersionId: typeof runVersionId === "string" ? runVersionId : null,
      };
    }
  } catch {
    // 꼬리가 잘렸으면 아무 일도 하지 않는다.
  }

  const count = Number(tokens);
  return {
    answer,
    tail: {
      contextTokens: tokens && Number.isFinite(count) ? count : null,
      saved: flag !== UNSAVED,
      actions,
    },
  };
}
