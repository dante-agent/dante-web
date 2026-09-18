"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  saveSlackNotifications,
  sendSlackTest,
  type SaveState,
  type SlackTestState,
} from "@/app/project/[projectRef]/settings/notifications/actions";
import { FormStatus, Section, ToggleRow } from "@/components/settings/notifications/controls";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SLACK_EVENTS, type SlackEvents } from "@/lib/notifications/settings";
import type { SlackChannel } from "@/lib/slack/channels";

// Slack 섹션 (docs/notifications-slack.md §11). 워크스페이스가 붙어 있을 때만 그린다 —
// 안 붙어 있으면 페이지가 팀 설정으로 가는 안내를 대신 띄운다.
//
// 저장과 테스트는 같은 폼을 다른 액션으로 보낸다. 테스트는 저장 전에 고른 채널로도 간다.

export function SlackNotificationsForm({
  projectRef,
  workspace,
  channels,
  channelsError,
  initial,
}: {
  projectRef: string;
  workspace: string;
  channels: SlackChannel[];
  /** 채널 목록을 못 받았을 때 Slack 이 준 코드. 저장된 채널은 그래도 보여준다 */
  channelsError: string | null;
  initial: {
    slackEnabled: boolean;
    slackChannelId: string | null;
    slackChannelName: string | null;
    slackEvents: SlackEvents;
  };
}) {
  const [saveState, saveAction, saving] = useActionState<SaveState, FormData>(
    saveSlackNotifications,
    null
  );
  const [testState, testAction, testing] = useActionState<SlackTestState, FormData>(
    sendSlackTest,
    null
  );

  const [enabled, setEnabled] = useState(initial.slackEnabled);
  const [channelId, setChannelId] = useState(initial.slackChannelId ?? "");
  const [events, setEvents] = useState(initial.slackEvents);
  const [last, setLast] = useState<"save" | "test" | null>(null);

  // action 대신 onSubmit 으로 보낸다. React 19 는 <form action> 이 끝나면 폼을 reset 해서
  // 체크박스가 처음 값으로 돌아가 보인다 (discord-form.tsx 와 같은 이유).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    const test = submitter?.dataset.action === "test";
    setLast(test ? "test" : "save");
    startTransition(() => (test ? testAction : saveAction)(formData));
  };

  // 저장된 채널이 목록에 없을 수 있다(보관됨, 봇이 비공개 채널에서 나감, 목록 조회 실패).
  // 그래도 선택지에 남겨 둔다 — 안 그러면 저장하는 순간 채널이 조용히 비워진다.
  const items = channels.map((channel) => ({
    value: channel.id,
    label: `#${channel.name}${channel.isPrivate ? " (private)" : ""}`,
  }));
  if (initial.slackChannelId && !channels.some((c) => c.id === initial.slackChannelId)) {
    items.unshift({
      value: initial.slackChannelId,
      label: `#${initial.slackChannelName ?? initial.slackChannelId}`,
    });
  }

  return (
    <form onSubmit={submit}>
      <input type="hidden" name="projectRef" value={projectRef} />

      <Section
        title="Slack"
        description={`Posts results to a channel in ${workspace}. Only conclusions are sent — never progress.`}
      >
        <ToggleRow
          name="slackEnabled"
          label="Post to Slack"
          checked={enabled}
          onChange={setEnabled}
        />

        <div className="border-border border-b p-4">
          <span className="block text-[13px] leading-tight">Channel</span>
          <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">
            Private channels only show up after you invite @dante to them.
          </span>
          {/* name 을 주면 Base UI 가 숨은 input 을 만들어 폼에 값이 실린다 (runtime-form.tsx). */}
          <Select
            name="slackChannelId"
            value={channelId}
            onValueChange={(value) => setChannelId(String(value ?? ""))}
            items={items}
          >
            <SelectTrigger
              size="sm"
              className="mt-3 w-64 pr-2.5 text-[13px] data-[size=sm]:rounded-[4px]"
            >
              <SelectValue placeholder="Choose a channel" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {channelsError && (
            <p className="text-destructive mt-2 text-[12px]">
              Couldn&apos;t list channels. Slack said: {channelsError}
            </p>
          )}
        </div>

        {SLACK_EVENTS.map((event) => (
          <ToggleRow
            key={event.id}
            name={`slackEvent.${event.id}`}
            label={event.label}
            hint={event.hint}
            checked={events[event.id]}
            disabled={!enabled}
            onChange={(next) => setEvents((prev) => ({ ...prev, [event.id]: next }))}
          />
        ))}
      </Section>

      {/* 버튼 글자는 진행 중에도 바꾸지 않는다(discord-form.tsx). 진행 표시는 상태 자리 하나에서만. */}
      <div className="mt-4 flex max-w-2xl flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={saving || testing} className="rounded-[4px]">
          Save
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          data-action="test"
          disabled={saving || testing || !channelId}
          className="rounded-[4px]"
        >
          Send a test message
        </Button>

        <FormStatus
          pending={last === "save" ? saving : testing}
          pendingLabel={last === "save" ? "Saving…" : "Sending…"}
          done={last === "save" ? saveState?.saved : testState?.sent}
          doneLabel={last === "save" ? "Saved" : "Sent — check the channel"}
          error={last === "save" ? saveState?.error : testState?.error}
        />
      </div>
    </form>
  );
}
