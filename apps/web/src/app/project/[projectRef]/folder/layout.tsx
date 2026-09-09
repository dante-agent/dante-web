import { Suspense } from "react";
import { SubSidebar } from "@/components/sub-sidebar";
import { FileTree } from "@/components/file-tree";
import { mockFileTree } from "@/lib/mock-data";

// 폴더 보기 섹션 셸. 서브 사이드바에 파일 트리가 붙는다.
// 트리는 useSearchParams 를 쓰므로 Suspense 로 감싼다 (프로덕션 빌드 요구사항).
// 데이터는 아직 목업 — Octokit 붙으면 mockFileTree → 서버 조회로 교체.
export default function FolderLayout({ children }: LayoutProps<"/project/[projectRef]/folder">) {
  return (
    <SubSidebar
      nav={
        <Suspense fallback={null}>
          <FileTree entries={mockFileTree} />
        </Suspense>
      }
    >
      {children}
    </SubSidebar>
  );
}
