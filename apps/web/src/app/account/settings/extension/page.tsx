import { ComingSoon, SettingsHeader } from "@/components/settings/settings-section";

// 익스텐션 연결.
//
// 프로젝트가 아니라 계정 아래 둔 이유: 페어링은 "이 사람의 이 에디터"에 붙는다.
// 프로젝트마다 다시 연결하게 하면 레포를 하나 더 붙일 때마다 같은 일을 반복한다.
// 프로젝트 화면에는 연결 상태만 읽기로 비친다.
export default function AccountExtensionPage() {
  return (
    <>
      <SettingsHeader
        title="Extension"
        description="Pair the Dante editor extension with this account. One pairing covers every project you connect."
      />

      <ComingSoon>
        Pairing codes and the list of connected editors. The extension lives in the separate
        <span className="font-mono"> dante-extension </span>
        repo, so this page waits on its handshake landing first.
      </ComingSoon>
    </>
  );
}
