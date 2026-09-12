"use client";

// 메인 사이드바 — 프로젝트 셸의 왼쪽 아이콘 레일. 껍데기는 sidebar-rail 에 있다.
// 클라 코드는 projectRef 로 링크를 만드는 것뿐. 서브 사이드바는 섹션별 중첩 layout 이 담당한다.

import { useParams } from "next/navigation";
import { LayoutDashboard, Folder, Sparkles, Settings } from "lucide-react";
import { SidebarRail } from "@/components/sidebar-rail";

// subSidebar: 이 섹션에 서브 사이드바가 있다 → 활성 아이콘 재클릭으로 접기/펼치기
const ITEMS = [
  { key: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { key: "folder", label: "Explorer", Icon: Folder, subSidebar: true },
  { key: "recommend", label: "AI Recommendations", Icon: Sparkles, subSidebar: true },
  { key: "settings", label: "Settings", Icon: Settings },
] as const;

export function ProjectSidebar() {
  const { projectRef } = useParams<{ projectRef: string }>();

  return (
    <SidebarRail
      items={ITEMS.map(({ key, label, Icon, ...rest }) => ({
        href: `/project/${projectRef}/${key}`,
        label,
        Icon,
        togglesSubSidebar: "subSidebar" in rest,
      }))}
    />
  );
}
