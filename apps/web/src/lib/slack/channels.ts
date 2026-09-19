import { unstable_cache } from "next/cache";
import { slackCall } from "@/lib/slack/api";

// ⚠️ 서버 전용. 채널 목록·확인과 메시지 보내기.

export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
  /** 봇이 들어가 있는가. 비공개 채널은 초대돼야 목록에 보이고, 공개 채널은 몰라도 보낼 수 있다 */
  isMember: boolean;
};

type ConversationsList = {
  channels: { id: string; name: string; is_private: boolean; is_member: boolean }[];
  response_metadata?: { next_cursor?: string };
};

/** 목록을 끝까지 읽지 않는다. 채널이 수천 개인 워크스페이스에서 설정 화면이 멈춘다. */
const MAX_PAGES = 5;

/**
 * 채널 선택기에 띄울 목록. 보관된 채널은 뺀다.
 *
 * 비공개 채널은 봇이 초대된 것만 온다(groups:read 의 규칙). 그래서 "왜 우리 비공개
 * 채널이 없지"에 대한 답은 화면 문구가 한다.
 */
export async function listSlackChannels(token: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor = "";

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await slackCall<ConversationsList>("conversations.list", token, {
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 1000,
      cursor: cursor || undefined,
    });

    for (const channel of data.channels) {
      channels.push({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isMember: channel.is_member,
      });
    }

    cursor = data.response_metadata?.next_cursor ?? "";
    if (!cursor) break;
  }

  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 채널 목록 캐시 수명(초). 설정 화면을 열 때마다 conversations.list 를 최대 5번 차례로 불렀다.
 * 짧게 둔다 — 봇을 비공개 채널에 초대한 뒤 새로고침하면 곧 보여야 한다.
 */
const CHANNELS_TTL_SECONDS = 60;

/**
 * listSlackChannels 를 팀(연결) 단위로 잠깐 캐시한다.
 *
 * 키는 팀 id 와 연결 행의 updatedAt 이다. 토큰은 키에 넣지 않는다 — 캐시 키는 캐시 저장소에
 * 그대로 남는다. 같은 팀·같은 updatedAt 이면 토큰도 같다. 다시 연결하면(다른 워크스페이스 포함)
 * updatedAt 이 바뀌어 새 항목이 되므로 따로 지울 필요가 없고, 끊기면 loadSlackConnection 이
 * null 이라 여기까지 오지 않는다. 실패는 캐시되지 않는다(던지면 저장하지 않는다).
 */
export function cachedSlackChannels(
  teamId: string,
  connection: { botToken: string; updatedAt: Date }
): Promise<SlackChannel[]> {
  return unstable_cache(
    () => listSlackChannels(connection.botToken),
    ["slack-channels", teamId, connection.updatedAt.toISOString()],
    { revalidate: CHANNELS_TTL_SECONDS }
  )();
}

/**
 * 저장하기 전에 채널이 이 워크스페이스에 실제로 있는지 본다. 폼에서 온 id 를 믿지 않는다.
 * 없으면 Slack 이 channel_not_found 를 던진다.
 */
export async function fetchSlackChannel(token: string, channelId: string) {
  const data = await slackCall<{ channel: { id: string; name: string; is_archived: boolean } }>(
    "conversations.info",
    token,
    { channel: channelId }
  );
  return data.channel;
}

/** 메시지 하나. 돌려주는 ts 가 그 메시지의 id 다 — 나중에 수정하거나 스레드를 다는 데 쓴다. */
export async function postSlackMessage(
  token: string,
  message: { channel: string; text: string; threadTs?: string; broadcast?: boolean }
) {
  const data = await slackCall<{ channel: string; ts: string }>("chat.postMessage", token, {
    channel: message.channel,
    text: message.text,
    // 링크 미리보기를 끈다. PR 링크마다 GitHub 카드가 펼쳐져 메시지가 세 배로 길어진다.
    unfurl_links: false,
    unfurl_media: false,
    thread_ts: message.threadTs,
    reply_broadcast: message.broadcast || undefined,
  });
  return { channel: data.channel, ts: data.ts };
}

/** 보낸 메시지 고쳐 쓰기. 알림은 다시 울리지 않는다 — 같은 소식의 숫자만 바뀔 때 쓴다. */
export async function updateSlackMessage(
  token: string,
  message: { channel: string; ts: string; text: string }
) {
  await slackCall("chat.update", token, {
    channel: message.channel,
    ts: message.ts,
    text: message.text,
  });
}
