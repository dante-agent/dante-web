import { prisma } from "@dante/db";
import { ConnectedEditors } from "@/components/settings/extension/connected-editors";
import { PairingCodeGuide } from "@/components/settings/extension/pairing-code-guide";
import { SettingsHeader } from "@/components/settings/settings-section";
import { requireUser } from "@/lib/auth/user";

// 익스텐션 연결.
//
// 프로젝트가 아니라 계정 아래 둔 이유: 페어링은 "이 사람의 이 에디터"에 붙는다.
// 프로젝트마다 다시 연결하게 하면 레포를 하나 더 붙일 때마다 같은 일을 반복한다.
// 프로젝트 화면에는 연결 상태만 읽기로 비친다.
export default async function AccountExtensionPage() {
  const user = await requireUser();

  // tokenHash 는 select 하지 않는다 — 화면에 필요 없고, 해시라도 내릴 이유가 없다.
  // 정렬은 최근에 쓴 것부터, 한 번도 안 쓴 건 뒤로, 그 안에서는 최근 연결 순.
  const editors = await prisma.extensionToken.findMany({
    where: { userId: user.id },
    select: { id: true, editor: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return (
    <>
      <SettingsHeader
        title="Extension"
        description="Editors signed in to this account through the Dante extension. One sign-in covers every project you connect."
      />

      <ConnectedEditors editors={editors} />

      <PairingCodeGuide />
    </>
  );
}
