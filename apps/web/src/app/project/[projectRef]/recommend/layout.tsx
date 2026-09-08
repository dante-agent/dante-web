import { SubSidebar } from "@/components/sub-sidebar";

// AI 추천 섹션 셸. 서브 사이드바(추천 파일 목록 → 상세)가 붙는다.
// nav 는 아직 비어 있음 — 목록은 추천 데이터 붙을 때.
export default function RecommendLayout({
  children,
}: LayoutProps<"/project/[projectRef]/recommend">) {
  return <SubSidebar>{children}</SubSidebar>;
}
