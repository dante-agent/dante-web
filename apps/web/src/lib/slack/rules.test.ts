import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { queuedRun, SAMPLE_RUNS } from "../notifications/run-summary.ts";
import { slackEventOf, slackPlan, type SlackThread } from "./rules.ts";

// settings.ts 의 DEFAULT_SLACK_EVENTS 와 같다. settings.ts 는 "@/" 경로로 import 해서
// node --test 가 읽지 못한다.
const DEFAULT_SLACK_EVENTS = { failed: true, recovered: true, passed: false, cannotFinish: true };
const none: SlackThread = { channelId: null, threadTs: null, messageTs: null, lastEvent: null };
const posted = (lastEvent: string): SlackThread => ({
  channelId: "C1",
  threadTs: "100.1",
  messageTs: "200.2",
  lastEvent,
});

describe("slackEventOf", () => {
  it("stays silent while the run is in progress", () => {
    assert.equal(slackEventOf(queuedRun({ detailUrl: null, rerunUrl: null }), null), null);
  });

  it("calls a pass after a failure a recovery", () => {
    assert.deepEqual(slackEventOf(SAMPLE_RUNS.passing, "failed"), {
      event: "recovered",
      conclusion: "passed",
    });
    assert.equal(slackEventOf(SAMPLE_RUNS.passing, null)?.event, "passed");
  });

  it("reports our own failure separately from failing tests", () => {
    const run = { ...queuedRun({ detailUrl: null, rerunUrl: null }), status: "failed" as const };
    assert.equal(slackEventOf(run, null)?.event, "cannotFinish");
    assert.equal(slackEventOf(SAMPLE_RUNS.failing, null)?.event, "failed");
  });
});

describe("slackPlan", () => {
  const failed = { event: "failed" as const, conclusion: "failed" as const };

  it("posts the first message for a pull request", () => {
    assert.deepEqual(slackPlan(failed, DEFAULT_SLACK_EVENTS, "C1", none), { kind: "post" });
  });

  it("edits the last message when the same failure repeats", () => {
    assert.deepEqual(slackPlan(failed, DEFAULT_SLACK_EVENTS, "C1", posted("failed")), {
      kind: "update",
      ts: "200.2",
    });
  });

  it("replies in the thread when the conclusion changes", () => {
    const recovered = { event: "recovered" as const, conclusion: "passed" as const };
    assert.deepEqual(slackPlan(recovered, DEFAULT_SLACK_EVENTS, "C1", posted("failed")), {
      kind: "reply",
      threadTs: "100.1",
    });
  });

  it("starts over in a new channel", () => {
    assert.deepEqual(slackPlan(failed, DEFAULT_SLACK_EVENTS, "C2", posted("failed")), {
      kind: "post",
    });
  });

  it("skips passing runs by default", () => {
    const passed = { event: "passed" as const, conclusion: "passed" as const };
    assert.equal(slackPlan(passed, DEFAULT_SLACK_EVENTS, "C1", none).kind, "skip");
  });
});
