import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { displayName, requireUser } from "@/lib/auth/user";

// 계정 설정 셸.
//
// 여기 있는 값은 전부 "사용자 1명"에 붙는다 — 프로젝트를 몇 개 연결하든 같은
// 값을 본다. 프로젝트 설정(/project/<ref>/settings)과 URL 부터 갈라 둔 이유가
// 그것이다. 예전에는 API 키가 프로젝트 설정 안에 있어서 본문에
// "이 키는 사실 계정 것입니다" 라고 해명을 달아야 했다.
const ITEMS = [
  { href: "/account/settings/general", label: "General" },
  // 내가 속한 팀 목록. 팀 자체의 설정은 /team/<id>/settings 에 있다.
  { href: "/account/settings/teams", label: "Teams" },
  { href: "/account/settings/ai", label: "AI" },
  { href: "/account/settings/extension", label: "Extension" },
];

// 탭 제목: "Teams · Account · Dante". 루트 템플릿은 여기서 한 번 덮이므로 " · Dante" 까지 적는다.
export const metadata: Metadata = {
  title: { default: "Account", template: "%s · Account · Dante" },
};

export default async function AccountSettingsLayout({
  children,
}: LayoutProps<"/account/settings">) {
  const user = await requireUser();

  // 이름은 displayName() 한 곳에서만 정한다 — 헤더 메뉴와 다른 이름이 뜨면 안 된다.
  // replace: 탭을 오간 기록이 쌓이면 레일의 뒤로가기(router.back)가 들어온
  // 페이지가 아니라 직전 탭으로 간다.
  return (
    <SettingsShell title="Account" scope={displayName(user)} items={ITEMS} replace>
      {children}
    </SettingsShell>
  );
}
