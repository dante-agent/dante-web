// 데이터 연결 전까지 레이아웃을 잡기 위한 목업. 실제 조회 붙이면 이 파일은 삭제.

export type SessionStatus = "needs_clarification" | "in_progress" | "completed";

export interface AiSession {
  id: string;
  title: string;
  status: SessionStatus;
  updatedAt: string;
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface TestRecommendation {
  id: string;
  componentName: string;
  filePath: string;
  /** 왜 이 컴포넌트에 테스트가 필요한지 — 결제 로직, 인증, 복잡한 분기 등 */
  reason: string;
  priority: RecommendationPriority;
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
  recommendations: [
    {
      id: "r-1",
      componentName: "CheckoutForm",
      filePath: "src/components/checkout/CheckoutForm.tsx",
      reason: "결제·주문 등 핵심 비즈니스 로직인데 테스트 파일이 없음",
      priority: "high",
    },
    {
      id: "r-2",
      componentName: "useAuth",
      filePath: "src/hooks/useAuth.ts",
      reason: "인증·로그인·권한 관련 로직",
      priority: "high",
    },
    {
      id: "r-3",
      componentName: "OrderSummary",
      filePath: "src/components/order/OrderSummary.tsx",
      reason: "과거 버그가 발생했던 코드 (#412)",
      priority: "medium",
    },
    {
      id: "r-4",
      componentName: "formatPrice",
      filePath: "src/utils/formatPrice.ts",
      reason: "여러 곳에서 사용하는 공통 함수",
      priority: "medium",
    },
    {
      id: "r-5",
      componentName: "Tooltip",
      filePath: "src/components/ui/Tooltip.tsx",
      reason: "단순 UI 컴포넌트 — 우선순위 낮음",
      priority: "low",
    },
  ] as TestRecommendation[],
};
