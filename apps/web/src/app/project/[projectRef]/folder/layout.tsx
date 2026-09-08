import { SubSidebar } from "@/components/sub-sidebar";

// 폴더 보기 섹션 셸. 서브 사이드바(폴더 구조 / 개별 파일 트리)가 붙는다.
// nav 는 아직 비어 있음 — 트리는 레포 연결·데이터 붙을 때.
export default function FolderLayout({ children }: LayoutProps<"/project/[projectRef]/folder">) {
  return <SubSidebar>{children}</SubSidebar>;
}
