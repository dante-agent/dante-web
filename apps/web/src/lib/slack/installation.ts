import { prisma } from "@dante/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";
import { slackCall } from "@/lib/slack/api";

// ⚠️ 서버 전용. 팀의 Slack 연결 행을 읽고 쓴다.
//
// 권한 검사는 여기서 하지 않는다. 부르는 쪽(라우트·서버 액션)이 owner 인지 먼저 본다 —
// 알림을 보내는 쪽(PR 작업)은 사람 없이 돌아서 검사할 사람이 없기 때문이다.

export type SlackConnection = {
  slackTeamId: string;
  slackTeamName: string;
  botToken: string;
  /** 연결 행이 마지막으로 바뀐 때. 다시 연결하면 바뀐다 — 채널 목록 캐시의 키로 쓴다(channels.ts) */
  updatedAt: Date;
};

/** 알림을 보낼 때 쓰는 연결. 없거나 끊겼으면 null. */
export async function loadSlackConnection(teamId: string): Promise<SlackConnection | null> {
  const row = await prisma.slackInstallation.findUnique({ where: { teamId } });
  if (!row || row.revokedAt) return null;

  return {
    slackTeamId: row.slackTeamId,
    slackTeamName: row.slackTeamName,
    botToken: decryptSecret(row.encryptedBotToken),
    updatedAt: row.updatedAt,
  };
}

/**
 * 연결을 저장한다. 이미 있으면 덮어쓴다(다시 연결).
 *
 * 다른 워크스페이스로 바꿔 붙이면 옛 토큰을 Slack 쪽에서도 폐기한다. 행만 덮으면
 * 옛 워크스페이스에 앱이 설치된 채로 남는데, 그걸 지울 수 있는 화면이 우리에게 없다.
 */
export async function saveSlackInstallation(
  teamId: string,
  userId: string,
  install: {
    botToken: string;
    botUserId: string;
    scopes: string[];
    slackTeamId: string;
    slackTeamName: string;
  }
) {
  const previous = await prisma.slackInstallation.findUnique({ where: { teamId } });

  const fields = {
    slackTeamId: install.slackTeamId,
    slackTeamName: install.slackTeamName,
    botUserId: install.botUserId,
    encryptedBotToken: encryptSecret(install.botToken),
    scopes: install.scopes,
    installedById: userId,
    revokedAt: null,
  };

  await prisma.slackInstallation.upsert({
    where: { teamId },
    create: { teamId, ...fields },
    update: fields,
  });

  if (previous && previous.slackTeamId !== install.slackTeamId) {
    await revokeToken(previous.encryptedBotToken);
  }
}

/** 연결을 끊는다. Slack 쪽 토큰도 폐기한다 — 우리가 지워도 토큰은 살아 있다. */
export async function deleteSlackInstallation(teamId: string) {
  const row = await prisma.slackInstallation.findUnique({ where: { teamId } });
  if (!row) return;

  await prisma.slackInstallation.delete({ where: { teamId } });
  if (!row.revokedAt) await revokeToken(row.encryptedBotToken);
}

/**
 * 호출이 token_revoked 같은 답을 받았을 때 찍는다. 설정 화면이 "다시 연결" 배지를 띄운다.
 * Events API 로 앱 삭제를 받지 않는 이유는 docs/notifications-slack.md §3.3.
 */
export async function markSlackRevoked(teamId: string) {
  await prisma.slackInstallation.updateMany({
    where: { teamId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** 폐기는 최선만 다한다. 이미 죽은 토큰이면 Slack 이 invalid_auth 를 주는데, 그것도 목적은 이룬 것이다. */
async function revokeToken(encryptedBotToken: string) {
  try {
    await slackCall("auth.revoke", decryptSecret(encryptedBotToken));
  } catch (error) {
    console.warn("[slack] auth.revoke failed", error);
  }
}
