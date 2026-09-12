// AI 세션 목록용 목업. 세션 영속화(테이블+마이그레이션)가 붙으면 이 파일은 삭제.
// 추천 리스트는 실데이터로 옮겼다 → lib/projects/recommendations.ts

export type SessionStatus = "needs_clarification" | "in_progress" | "completed";

export interface AiSession {
  id: string;
  title: string;
  status: SessionStatus;
  updatedAt: string;
}

export const recommendMock = {
  sessions: [
    {
      id: "s-1",
      title: "CheckoutForm 결제 검증 로직 테스트 생성",
      status: "needs_clarification",
      updatedAt: "2026-09-10T14:20:00+09:00",
    },
    {
      id: "s-2",
      title: "useAuth 훅 토큰 갱신 케이스",
      status: "in_progress",
      updatedAt: "2026-09-10T13:05:00+09:00",
    },
    {
      id: "s-3",
      title: "PricingTable 조건부 렌더링",
      status: "completed",
      updatedAt: "2026-09-10T09:40:00+09:00",
    },
    {
      id: "s-4",
      title: "OrderSummary API 에러 핸들링",
      status: "completed",
      updatedAt: "2026-09-09T18:12:00+09:00",
    },
  ] as AiSession[],
};
