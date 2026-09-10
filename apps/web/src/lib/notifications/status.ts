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
  ref: string;
  installationId: bigint;
};

export async function notificationBadges(project: BadgeInput): Promise<NotificationBadge[]> {
  const connection = projectConnection(project);

  // 연결이 끊긴 상태면 권한을 따질 것도 없다. 넓은 사유가 이긴다
  // (lib/github/connection.ts 와 같은 규칙).
  if (connection !== "ok") {
    return [
      {
        tone: "error",
        title:
          connection === "app_removed" || connection === "suspended"
            ? "GitHub is disconnected"
            : "This repository left the installation",
        description: "Nothing is written to pull requests until access comes back.",
        action: { label: "Open GitHub settings", href: `/project/${project.ref}/settings/github` },
      },
    ];
  }

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
        href: installationSettingsUrl(project.installationId),
      },
    });
  }

  if (await deliveriesFailing(project.id)) {
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
    const installation = await fetchInstallation(Number(installationId));
    const permissions = installation.permissions as Record<string, string | undefined>;

    return (["pull_requests", "checks"] as const).filter(
      (permission) => permissions[permission] !== "write"
    );
  } catch {
    return [];
  }
}
