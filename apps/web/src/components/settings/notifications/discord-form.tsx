"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import {
  saveDiscordNotifications,
  sendDiscordTest,
  type DiscordTestState,
  type SaveState,
} from "@/app/project/[projectRef]/settings/notifications/actions";
import { RadioRow, Section, ToggleRow } from "@/components/settings/notifications/controls";
import { Button } from "@/components/ui/button";
import { DISCORD_EVENTS, DISCORD_LOCALES } from "@/lib/notifications/discord";
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

  return (
    <form action={saveAction}>
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
        {DISCORD_LOCALES.map((option) => (
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

      <div className="mt-6 flex max-w-2xl flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={saving} className="rounded-[4px]">
          {saving ? "Saving..." : "Save"}
        </Button>
        {/* 같은 폼을 다른 액션으로 보낸다. 붙여 넣고 아직 저장하지 않은 URL 로도 시험할 수 있다. */}
        <Button
          type="submit"
          size="sm"
          variant="outline"
          formAction={testAction}
          disabled={testing}
          className="rounded-[4px]"
        >
          {testing ? "Sending..." : "Send a test notification"}
        </Button>

        {saveState?.saved && (
          <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
            <Check className="size-3.5" />
            Saved
          </span>
        )}
        {testState?.sent && (
          <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
            <Check className="size-3.5" />
            Sent — check the channel
          </span>
        )}
        {(saveState?.error ?? testState?.error) && (
          <span role="alert" className="text-destructive text-[13px]">
            {saveState?.error ?? testState?.error}
          </span>
        )}
      </div>
    </form>
  );
}
