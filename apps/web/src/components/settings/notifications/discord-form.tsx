"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  saveDiscordNotifications,
  sendDiscordTest,
  type DiscordTestState,
  type SaveState,
} from "@/app/project/[projectRef]/settings/notifications/actions";
import { RadioRow, Section, ToggleRow } from "@/components/settings/notifications/controls";
import { FormStatus } from "@/components/settings/notifications/form-status";
import { Button } from "@/components/ui/button";
import { DISCORD_EVENTS } from "@/lib/notifications/discord";
import { NOTIFICATION_LOCALES } from "@/lib/notifications/locale";
import type { NotificationSettings } from "@/lib/notifications/settings";

// Discord 섹션. 채널의 웹훅 URL 하나로 붙는다 — Slack 처럼 OAuth 가 없어서 팀 설정에
// 따로 연결하는 층이 없다.
//
// 저장된 URL 은 화면에 되돌려 보내지 않는다(settings.ts 의 discordWebhookSaved). 그래서
// 입력칸은 늘 비어 있고, 비운 채 저장하면 저장된 URL 을 그대로 둔다.

export function DiscordNotificationsForm({
  projectRef,
  initial,
}: {
  projectRef: string;
  initial: NotificationSettings;
}) {
  const [saveState, saveAction, saving] = useActionState<SaveState, FormData>(
    saveDiscordNotifications,
    null
  );
  const [testState, testAction, testing] = useActionState<DiscordTestState, FormData>(
    sendDiscordTest,
    null
  );

  const [enabled, setEnabled] = useState(initial.discordEnabled);
  const [events, setEvents] = useState(initial.discordEvents);
  const [locale, setLocale] = useState(initial.discordLocale);
  /** 마지막으로 누른 버튼. 상태 문구는 그 결과 하나만 보인다 — 둘이 나란히 쌓이면 무엇의 결과인지 헷갈린다 */
  const [last, setLast] = useState<"save" | "test" | null>(null);

  // action 대신 onSubmit 으로 보낸다. React 19 는 <form action> 이 끝나면 폼을 reset 하는데,
  // 그러면 라디오·체크박스가 처음 그렸을 때 값으로 돌아가 보인다(상태는 그대로라 다시 그려지지도
  // 않는다). 한국어를 저장했는데 English 에 점이 찍혀 있던 이유다.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    const test = submitter?.dataset.action === "test";
    setLast(test ? "test" : "save");
    startTransition(() => (test ? testAction : saveAction)(formData));
  };

  return (
    <form onSubmit={submit}>
      <input type="hidden" name="projectRef" value={projectRef} />

      <Section
        title="Discord"
        description="Posts the result to a Discord channel. Only finished runs are sent — never the progress in between."
      >
        <ToggleRow
          name="discordEnabled"
          label="Post to Discord"
          checked={enabled}
          onChange={setEnabled}
        />

        <label className="border-border block border-b p-4">
          <span className="block text-[13px] leading-tight">Webhook URL</span>
          <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">
            In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.
            {initial.discordWebhookSaved && " A webhook is saved. Paste a new one to replace it."}
          </span>
          <input
            type="url"
            name="discordWebhookUrl"
            autoComplete="off"
            placeholder={
              initial.discordWebhookSaved
                ? "Saved — leave empty to keep it"
                : "https://discord.com/api/webhooks/…"
            }
            className="border-border bg-background mt-3 w-full border px-2 py-1.5 font-mono text-[12px]"
          />
        </label>

        {DISCORD_EVENTS.map((event) => (
          <ToggleRow
            key={event.id}
            name={`discordEvent.${event.id}`}
            label={event.label}
            hint={event.hint}
            checked={events[event.id]}
            disabled={!enabled}
            onChange={(value) => setEvents((current) => ({ ...current, [event.id]: value }))}
          />
        ))}
      </Section>

      <Section
        title="Message language"
        description="Test names and error messages stay as they are."
      >
        {NOTIFICATION_LOCALES.map((option) => (
          <RadioRow
            key={option.id}
            name="discordLocale"
            value={option.id}
            label={option.label}
            selected={locale === option.id}
            onSelect={() => setLocale(option.id)}
          />
        ))}
      </Section>

      {/* 버튼 글자는 진행 중에도 바꾸지 않는다. 폭이 바뀌면 옆 버튼과 상태 문구가 밀린다.
          진행 표시는 오른쪽 상태 자리 하나에서만 한다. */}
      <div className="mt-6 flex max-w-2xl flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={saving || testing} className="rounded-[4px]">
          Save
        </Button>
        {/* 같은 폼을 테스트 액션으로 보낸다(submit 참고). 붙여 넣고 아직 저장하지 않은 URL 로도 시험할 수 있다. */}
        <Button
          type="submit"
          size="sm"
          variant="outline"
          data-action="test"
          disabled={saving || testing}
          className="rounded-[4px]"
        >
          Send a test notification
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
