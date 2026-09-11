"use client";

// 계정 셸의 왼쪽 레일. 프로젝트 레일과 같은 자리·같은 폭이라 화면을 오가도
// 본문이 움직이지 않는다. 계정은 프로젝트 밖이라 항목은 나가는 문 하나뿐이다.
//
// 서버 컴포넌트(account/layout)는 아이콘 함수를 props 로 넘길 수 없어서
// 항목을 여기서 정한다.

import { ArrowLeft } from "lucide-react";
import { SidebarRail } from "@/components/sidebar-rail";

const ITEMS = [{ href: "/projects", label: "Back to projects", Icon: ArrowLeft }];

export function AccountSidebar() {
  return <SidebarRail items={ITEMS} />;
}
