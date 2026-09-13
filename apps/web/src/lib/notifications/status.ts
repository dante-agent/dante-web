import { revalidateTag, unstable_cache } from "next/cache";
import { fetchInstallation, installationSettingsUrl } from "@/lib/github/app";
import { projectConnection, type ProjectConnection } from "@/lib/github/connection";
import { deliveriesFailing } from "@/lib/notifications/store";

// ⚠️ 서버 전용.
//
// 알림 화면 위에 뜨는 배지. `settings/github` 의 연결 상태와는 다른 층을 본다.
//
//   settings/github  "레포에 닿을 수 있나"    (설치가 살아 있나, 이 레포가 들어 있나)
//   여기             "PR 에 쓸 수 있나"       (권한이 있나, 최근에 실제로 전달됐나)
//
// 권한 부족이 실제로 흔하다. App 에 권한을 추가해도 기존 설치가 자동으로 따라오지
// 않기 때문이다 — 사용자가 GitHub 에서 새 권한을 승인해야 하고, 그때까지 API 는
// 403 Resource not accessible by integration 을 낸다.

export type NotificationBadge = {
  tone: "warn" | "error";
  title: string;
  description: string;
  action?: { label: string; href: string };
};

type BadgeInput = ProjectConnection & {
  id: string;
  installationId: bigint;
  // 설정 URL 은 개인 계정과 조직의 경로가 달라 계정 정보까지 필요하다
  // (`installationSettingsUrl`).
  installation: { id: bigint; accountLogin: string; accountType: string };
};

/**
 * `deliveries` 는 화면이 이미 읽은 최근 전달 로그다. 실패 배지를 그걸로 판단해
 * 같은 표를 한 번 더 읽지 않는다(store.ts 의 deliveriesFailing).
 */
export async function notificationBadges(
  project: BadgeInput,
  deliveries: { status: string }[]
): Promise<NotificationBadge[]> {
  // 연결이 끊긴 상태의 문구는 여기서 쓰지 않는다. `lib/github/connection.ts` 의
  // connectionNotice 가 상태별 문구와 다음 행동(재설치·레포 다시 열기…)까지
  // 들고 있고, 화면은 그걸 ConnectionBanner 로 그린다. 같은 상태에 문구가 두 벌
  // 생기면 한쪽만 고쳐질 뿐이다.
  //
  // 넓은 사유가 이기므로 그때는 권한도 따지지 않는다 — 앱이 지워졌는데
  // "코멘트 권한이 없습니다"를 같이 띄우면 할 일이 두 개로 보인다.
  if (projectConnection(project) !== "ok") return [];

  const badges: NotificationBadge[] = [];

  for (const missing of await missingPermissions(project.installationId)) {
    badges.push({
      tone: "error",
      title:
        missing === "pull_requests"
          ? "No permission to comment on pull requests"
          : "No permission to create checks",
      description:
        "Adding a permission to the App does not update installations that already exist — approve it on GitHub.",
      action: {
        label: "Approve on GitHub",
        href: installationSettingsUrl(project.installation),
      },
    });
  }

  if (await deliveriesFailing(project.id, deliveries)) {
    badges.push({
      tone: "warn",
      title: "Recent notifications were not delivered",
      description: "The last three attempts failed. The delivery log has GitHub's own wording.",
      action: { label: "See the delivery log", href: "#delivery-log" },
    });
  }

  return badges;
}

/**
 * 설치에 없는 쓰기 권한.
 *
 * 못 물어보면(GitHub 이 죽었거나 설치가 막 사라졌거나) 빈 배열을 준다 —
 * 확인이 안 됐다고 "권한 없음" 배지를 띄우면 멀쩡한 설정 화면에 거짓 경고가 뜬다.
 */
async function missingPermissions(installationId: bigint) {
  try {
    return await unstable_cache(fetchMissingPermissions, ["github-installation-permissions"], {
      tags: [permissionsTag(installationId)],
      revalidate: PERMISSIONS_TTL_SECONDS,
    })(String(installationId));
  } catch {
    return [];
  }
}

/**
 * 권한 캐시 수명(초). 권한은 사용자가 GitHub 에서 승인할 때만 바뀌고, 그때는 웹훅
 * (installation.new_permissions_accepted)과 Recheck 가 바로 비운다.
 */
const PERMISSIONS_TTL_SECONDS = 600;

const permissionsTag = (installationId: bigint | number) =>
  `installation:${installationId}:permissions`;

// 캐시 키가 JSON 이라 bigint 대신 문자열로 받는다. 던지면 캐시되지 않는다.
async function fetchMissingPermissions(installationId: string) {
  const installation = await fetchInstallation(Number(installationId));
  const permissions = installation.permissions as Record<string, string | undefined>;

  return (["pull_requests", "checks"] as const).filter(
    (permission) => permissions[permission] !== "write"
  );
}

/** 권한 배지 캐시를 바로 버린다. 웹훅(라우트 핸들러)에서도 부르므로 revalidateTag 다. */
export function invalidateInstallationPermissions(installationId: bigint | number) {
  revalidateTag(permissionsTag(installationId), { expire: 0 });
}
