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
  { href: "/account/settings/ai", label: "AI models" },
  { href: "/account/settings/extension", label: "Extension" },
];

export default async function AccountSettingsLayout({
  children,
}: LayoutProps<"/account/settings">) {
  const user = await requireUser();

  // 이름은 displayName() 한 곳에서만 정한다 — 헤더 메뉴와 다른 이름이 뜨면 안 된다.
  return (
    <SettingsShell title="Account" scope={displayName(user)} items={ITEMS}>
      {children}
    </SettingsShell>
  );
}
