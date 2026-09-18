import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DISCORD_EVENTS,
  discordAction,
  discordOutcome,
  isDiscordWebhookUrl,
  parseDiscordEvents,
  renderDiscordMessage,
} from "./discord.ts";
import { SAMPLE_RUNS, type RunSummary } from "./run-summary.ts";

const failing = SAMPLE_RUNS.failing;
const passing = SAMPLE_RUNS.passing;

describe("isDiscordWebhookUrl", () => {
  it("accepts webhook URLs Discord hands out", () => {
    assert.equal(isDiscordWebhookUrl("https://discord.com/api/webhooks/123/abc-DEF_1"), true);
    assert.equal(isDiscordWebhookUrl("https://ptb.discordapp.com/api/v10/webhooks/123/abc"), true);
  });

  it("rejects anything that would send our server elsewhere", () => {
    assert.equal(isDiscordWebhookUrl("http://discord.com/api/webhooks/123/abc"), false);
    assert.equal(isDiscordWebhookUrl("https://discord.com.evil.io/api/webhooks/123/abc"), false);
    assert.equal(isDiscordWebhookUrl("https://discord.com/api/webhooks/123/abc?x=1"), false);
    assert.equal(isDiscordWebhookUrl("https://discord.com/api/webhooks/123/abc/../x"), false);
  });
});

describe("parseDiscordEvents", () => {
  it("fills missing keys with defaults and drops unknown ones", () => {
    assert.deepEqual(parseDiscordEvents(null), DEFAULT_DISCORD_EVENTS);
    assert.deepEqual(parseDiscordEvents({ passed: true, other: true }), {
      ...DEFAULT_DISCORD_EVENTS,
      passed: true,
    });
  });
});

describe("discordOutcome", () => {
  it("only speaks for finished runs", () => {
    assert.equal(discordOutcome(failing), "failed");
    assert.equal(discordOutcome(passing), "passed");
    assert.equal(discordOutcome({ ...failing, status: "failed" }), "error");
    assert.equal(discordOutcome({ ...failing, status: "running" }), null);
    assert.equal(discordOutcome({ ...failing, status: "unchanged" }), null);
  });
});

describe("discordAction", () => {
  const events = DEFAULT_DISCORD_EVENTS;

  it("posts the first failure and edits the ones that follow", () => {
    assert.deepEqual(discordAction("failed", null, events), { kind: "post", event: "failed" });
    assert.deepEqual(discordAction("failed", "failed", events), { kind: "edit", event: "failed" });
  });

  it("posts a recovery so the channel hears about it", () => {
    assert.deepEqual(discordAction("passed", "failed", events), {
      kind: "post",
      event: "recovered",
    });
  });

  it("stays quiet on passing runs by default", () => {
    assert.equal(discordAction("passed", null, events).kind, "skip");
    assert.deepEqual(discordAction("passed", "passed", { ...events, passed: true }), {
      kind: "edit",
      event: "passed",
    });
  });

  it("does not log progress updates", () => {
    assert.deepEqual(discordAction(null, "failed", events), { kind: "none" });
  });
});

describe("renderDiscordMessage", () => {
  const context = {
    repo: "wlrnjs/my-blog",
    prNumber: 42,
    prUrl: "https://github.com/wlrnjs/my-blog/pull/42",
    failedLimit: 2,
  };

  it("names the repository and folds failures past the limit", () => {
    const text = renderDiscordMessage(failing, context);
    assert.ok(text.includes("**dante · 3 of 24 tests failed**"));
    assert.ok(text.includes("wlrnjs/my-blog #42"));
    assert.ok(text.includes("`Button.test.tsx` › renders disabled state"));
    assert.ok(text.includes("…and 1 more"));
    assert.ok(
      text.includes("[Open the pull request](<https://github.com/wlrnjs/my-blog/pull/42>)")
    );
  });

  it("tells a recovery apart from an ordinary pass", () => {
    assert.ok(
      renderDiscordMessage(passing, { ...context, recovered: true }).includes(
        "**dante · fixed — all 24 tests passed**"
      )
    );
    assert.ok(renderDiscordMessage(passing, context).includes("**dante · all 24 tests passed**"));
  });

  it("marks test notifications so nobody mistakes them for a real failure", () => {
    assert.match(renderDiscordMessage(failing, { ...context, test: true }), /^-# Test/);
  });

  it("stays under Discord's 2000 character limit", () => {
    const long: RunSummary = {
      ...failing,
      failures: Array.from({ length: 50 }, (_, i) => ({
        file: `File${i}.test.tsx`,
        name: "x".repeat(100),
        message: "y".repeat(100),
      })),
    };
    assert.equal(renderDiscordMessage(long, { ...context, failedLimit: 50 }).length, 2000);
  });
});
