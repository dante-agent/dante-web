"use client";

// 계정 셸의 왼쪽 레일. 프로젝트 레일과 같은 자리·같은 폭이라 화면을 오가도
// 본문이 움직이지 않는다. 계정은 프로젝트 밖이라 항목은 나가는 문 하나뿐이다.
//
// 서버 컴포넌트(account/layout)는 아이콘 함수를 props 로 넘길 수 없어서
// 항목을 여기서 정한다.
//
// 뒤로가기는 들어온 페이지로 돌아간다 — 프로젝트 대시보드·팀 설정 등 어디서든
// 계정 설정으로 올 수 있어서 목록으로 고정하면 맥락을 잃는다. 주소를 직접 쳐서
// 들어와 돌아갈 곳이 없을 때만 href(/projects)로 간다.

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SidebarRail } from "@/components/sidebar-rail";

export function AccountSidebar() {
  const router = useRouter();

  const items = [
    {
      href: "/projects",
      label: "Back",
      Icon: ArrowLeft,
      onClick: () => {
        if (window.history.length > 1) router.back();
        else router.push("/projects");
      },
    },
  ];

  return <SidebarRail items={items} />;
}
