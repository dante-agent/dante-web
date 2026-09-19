"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import {
  saveGithubNotifications,
  type SaveState,
} from "@/app/project/[projectRef]/settings/notifications/actions";
import { useAnnounce } from "@/components/live-announcer";
import { CommentMarkdown } from "@/components/settings/notifications/comment-markdown";
import { RadioRow, Section, ToggleRow } from "@/components/settings/notifications/controls";
import { Button } from "@/components/ui/button";
import { renderPrComment } from "@/lib/notifications/comment";
import { NOTIFICATION_LOCALES } from "@/lib/notifications/locale";
import type { RunSummary } from "@/lib/notifications/run-summary";
import {
  COMMENT_FIELDS,
  COMMENT_PRESETS,
  commentPresetOf,
  FAILED_LIMIT_MAX,
  FAILED_LIMIT_MIN,
  type CommentPreset,
  type NotificationSettings,
} from "@/lib/notifications/settings";

// GitHub 섹션 (§3~§5) + 미리보기 (§9).
//
// 한 컴포넌트인 이유는 미리보기 때문이다. 토글을 바꾸면 옆 패널이 바로 다시
// 그려져야 하는데, 그러려면 저장 전 값을 들고 있는 곳과 그리는 곳이 같아야 한다.
// 다른 채널에서는 "테스트 알림 1건 보내기" 버튼을 두지만 GitHub 은 진짜 PR 에
// 시험 코멘트를 달 수 없다 — 그래서 왕복을 없애는 방법이 미리보기뿐이다.

export function GithubNotificationsForm({
  projectRef,
  initial,
  samples,
  requiredCheck,
  repoRulesUrl,
}: {
  projectRef: string;
  initial: NotificationSettings;
  /** 실패 있음 / 전부 통과 두 가지. 이 프로젝트의 최근 실제 실행이 있으면 그걸 쓴다 */
  samples: { failing: RunSummary; passing: RunSummary };
  /** 레포에서 `dante` 가 required check 로 걸려 있는지 */
  requiredCheck: "required" | "not_required" | "unknown";
  /** 레포의 룰셋 설정 화면. required check 를 거는 곳 */
  repoRulesUrl: string;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    saveGithubNotifications,
    null
  );
  // "Saved" 는 조건부로 나타나서 스크린리더가 놓친다. 제출마다 새 state 라 연달아 저장해도 다시 읽힌다.
  useAnnounce(state?.saved ? "Saved" : null, state);

  // 저장 전 값. 폼 제출은 아래 name 들이 하고, 이 상태는 미리보기를 그린다.
  const [settings, setSettings] = useState(initial);
  const [preset, setPreset] = useState<CommentPreset>(commentPresetOf(initial.prCommentFields));
  const [tab, setTab] = useState<"failing" | "passing">("failing");

  const patch = (next: Partial<NotificationSettings>) =>
    setSettings((current) => ({ ...current, ...next }));

  const setField = (id: (typeof COMMENT_FIELDS)[number]["id"], value: boolean) => {
    const fields = { ...settings.prCommentFields, [id]: value };
    patch({ prCommentFields: fields });
    setPreset(commentPresetOf(fields));
  };

  const choosePreset = (name: CommentPreset) => {
    setPreset(name);
    if (name !== "custom") patch({ prCommentFields: COMMENT_PRESETS[name] });
  };

  const comment = settings.prCommentEnabled;

  return (
    <form action={formAction}>
      <input type="hidden" name="projectRef" value={projectRef} />

      <div className="flex flex-col gap-0 xl:flex-row xl:gap-10">
        <div className="min-w-0 flex-1">
          <Section title="Pull request comment" description="A summary in the conversation tab.">
            <ToggleRow
              name="prCommentEnabled"
              label="Comment on pull requests"
              checked={comment}
              onChange={(value) => patch({ prCommentEnabled: value })}
            />
            {/* 라디오 묶음에 이름을 준다 — 이 화면엔 라디오 세트가 여럿이라 이름 없이는 구분되지 않는다.
                테두리는 묶음이 대신 긋는다(안쪽 마지막 줄은 last:border-b-0 으로 선이 빠진다). */}
            <div role="radiogroup" aria-label="Comment mode" className="border-border border-b">
              <RadioRow
                name="prCommentMode"
                value="sticky"
                label="Keep one comment and edit it"
                hint="Every push overwrites the same comment, so the timeline stays readable."
                selected={settings.prCommentMode === "sticky"}
                onSelect={() => patch({ prCommentMode: "sticky" })}
              />
              <RadioRow
                name="prCommentMode"
                value="append"
                label="Post a new comment on every push"
                hint="For teams who would rather keep the history."
                selected={settings.prCommentMode === "append"}
                onSelect={() => patch({ prCommentMode: "append" })}
              />
            </div>
            <ToggleRow
              name="prCommentSkipUnchanged"
              label="Say nothing when no component changed"
              hint="A README-only pull request gets no comment at all."
              checked={settings.prCommentSkipUnchanged}
              disabled={!comment}
              onChange={(value) => patch({ prCommentSkipUnchanged: value })}
            />
            <ToggleRow
              name="prCommentCollapseOnPass"
              label="Collapse to one line when everything passes"
              checked={settings.prCommentCollapseOnPass}
              disabled={!comment}
              onChange={(value) => patch({ prCommentCollapseOnPass: value })}
            />
          </Section>

          <Section title="What the comment says">
            <div className="border-border flex flex-wrap gap-2 border-b p-4">
              {(["compact", "detailed", "custom"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  // 고른 프리셋은 색으로만 보인다. 스크린리더에는 눌림 상태로 전한다.
                  aria-pressed={preset === name}
                  onClick={() => choosePreset(name)}
                  className={
                    preset === name
                      ? "border-foreground bg-foreground text-background border px-3 py-1 text-[12px] capitalize"
                      : "border-border hover:bg-muted border px-3 py-1 text-[12px] capitalize"
                  }
                >
                  {name}
                </button>
              ))}
            </div>

            {/* 개별 토글은 Customize 를 골랐을 때만 편다. 8개가 늘 펼쳐져 있으면
                화면이 지저분하고, 대부분은 프리셋 둘 중 하나로 끝난다. */}
            {preset === "custom" &&
              COMMENT_FIELDS.map((field) => (
                <ToggleRow
                  key={field.id}
                  name={`field.${field.id}`}
                  label={field.label}
                  hint={field.hint}
                  checked={settings.prCommentFields[field.id]}
                  disabled={!comment}
                  onChange={(value) => setField(field.id, value)}
                />
              ))}

            {/* 프리셋만 고른 경우에도 값은 제출돼야 한다. */}
            {preset !== "custom" &&
              COMMENT_FIELDS.filter((field) => settings.prCommentFields[field.id]).map((field) => (
                <input key={field.id} type="hidden" name={`field.${field.id}`} value="on" />
              ))}

            <label className="flex items-center gap-3 p-4">
              <span className="text-[13px]">Show at most</span>
              <input
                type="number"
                name="prCommentFailedLimit"
                min={FAILED_LIMIT_MIN}
                max={FAILED_LIMIT_MAX}
                value={settings.prCommentFailedLimit}
                onChange={(event) =>
                  patch({ prCommentFailedLimit: Number(event.target.value) || FAILED_LIMIT_MIN })
                }
                className="border-border bg-background w-20 border px-2 py-1 text-[13px]"
              />
              <span className="text-muted-foreground text-[13px]">
                failed tests, then “…and N more”
              </span>
            </label>
          </Section>

          <Section
            title="Language"
            description="For the comment and the check run. Test names and error messages stay as they are."
          >
            <div role="radiogroup" aria-label="GitHub comment language">
              {NOTIFICATION_LOCALES.map((option) => (
                <RadioRow
                  key={option.id}
                  name="prCommentLocale"
                  value={option.id}
                  label={option.label}
                  selected={settings.prCommentLocale === option.id}
                  onSelect={() => patch({ prCommentLocale: option.id })}
                />
              ))}
            </div>
          </Section>

          <Section
            title="Check run"
            description="The pass/fail mark under the pull request. Named “dante”."
          >
            <ToggleRow
              name="checkRunEnabled"
              label="Create a check run"
              checked={settings.checkRunEnabled}
              onChange={(value) => patch({ checkRunEnabled: value })}
            />
            <ToggleRow
              name="checkRunBlocking"
              label="Block the merge when tests fail"
              hint="Reports a failure instead of a neutral result."
              checked={settings.checkRunBlocking}
              disabled={!settings.checkRunEnabled}
              onChange={(value) => patch({ checkRunBlocking: value })}
            />
            <RequiredCheckNote status={requiredCheck} rulesUrl={repoRulesUrl} />
          </Section>

          <div className="mt-6 flex max-w-2xl items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              focusableWhenDisabled
              className="rounded-[4px]"
            >
              {pending ? "Saving..." : "Save"}
            </Button>
            {state?.saved && (
              <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
                <Check className="size-3.5" />
                Saved
              </span>
            )}
            {state?.error && (
              <span role="alert" className="text-destructive text-[13px]">
                {state.error}
              </span>
            )}
          </div>
        </div>

        <CommentPreview
          markdown={renderPrComment(samples[tab], settings)}
          tab={tab}
          onTab={setTab}
          disabled={!comment}
        />
      </div>
    </form>
  );
}

/**
 * 우리가 머지를 직접 막지 못한다는 사실을 토글 옆에 붙인다.
 *
 * 이게 없으면 "켰는데 왜 안 막지?" 문의가 온다. 실제 차단은 레포의 branch
 * protection / ruleset 에서 `dante` 를 required check 로 걸어야 동작한다.
 * 그래서 확인이 안 되면 그 설정 화면으로 가는 링크를 같이 둔다.
 */
function RequiredCheckNote({
  status,
  rulesUrl,
}: {
  status: "required" | "not_required" | "unknown";
  rulesUrl: string;
}) {
  const text =
    status === "required"
      ? "“dante” is a required check on this repository, so a failure blocks the merge."
      : "Blocking only takes effect once “dante” is a required check in the repository’s branch protection or ruleset.";

  return (
    <p className="text-muted-foreground border-border border-t p-4 text-[12px] leading-relaxed">
      {text}
      {status !== "required" && (
        <>
          {" "}
          <a
            href={rulesUrl}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Add it as a required check on GitHub
          </a>{" "}
          <span className="text-muted-foreground">
            We cannot read classic branch protection with the permissions this App has, so we do not
            claim it is missing — only that we could not confirm it.
          </span>
        </>
      )}
    </p>
  );
}

/**
 * 미리보기 패널.
 *
 * GitHub 에서 보일 모양으로 렌더해서 보여준다. 채팅이 쓰는 react-markdown 을 그대로
 * 쓰고, 원본 HTML 을 다루는 방식은 CommentMarkdown 에 적어 두었다.
 */
function CommentPreview({
  markdown,
  tab,
  onTab,
  disabled,
}: {
  markdown: string;
  tab: "failing" | "passing";
  onTab: (tab: "failing" | "passing") => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-8 w-full shrink-0 xl:sticky xl:top-20 xl:mt-16 xl:w-[26rem] xl:self-start">
      <div className="flex items-center justify-between">
        {/* h2: 미리보기 안의 h3 가 앞 섹션 밑으로 들어가지 않게 제목 단계를 맞춘다. 모양은 그대로. */}
        <h2 className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
          Preview
        </h2>
        <div className="flex gap-1">
          {(["failing", "passing"] as const).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tab === name}
              onClick={() => onTab(name)}
              className={
                tab === name
                  ? "border-foreground border px-2 py-0.5 text-[11px] capitalize"
                  : "border-border text-muted-foreground hover:text-foreground border px-2 py-0.5 text-[11px] capitalize"
              }
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {disabled ? (
        <p className="border-border bg-card/40 text-muted-foreground mt-3 border p-4 text-[13px] leading-relaxed">
          Comments are off, so nothing is posted to the conversation tab.
        </p>
      ) : (
        <div className="border-border bg-card mt-3 max-h-[32rem] overflow-auto border p-4">
          <CommentMarkdown markdown={markdown} />
        </div>
      )}
    </div>
  );
}
