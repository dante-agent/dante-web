"use client";

// 메인 사이드바 — 프로젝트 셸의 왼쪽 아이콘 레일. 껍데기는 sidebar-rail 에 있다.
// 클라 코드는 projectRef 로 링크를 만드는 것뿐. 서브 사이드바는 섹션별 중첩 layout 이 담당한다.

import { useParams } from "next/navigation";
import { LayoutDashboard, Folder, Sparkles, Settings } from "lucide-react";
import { SidebarRail } from "@/components/sidebar-rail";

const ITEMS = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "folder", label: "Explorer", Icon: Folder },
  { key: "recommend", label: "AI Recommendations", Icon: Sparkles },
  { key: "settings", label: "Settings", Icon: Settings },
] as const;

export function ProjectSidebar() {
  const { projectRef } = useParams<{ projectRef: string }>();

  return (
    <SidebarRail
      items={ITEMS.map(({ key, label, Icon }) => ({
        href: `/project/${projectRef}/${key}`,
        label,
        Icon,
      }))}
    />
  );
}
