import { describe, expect, it } from "vitest";

import {
  NOTIFY_PROMPT_GAP_MS,
  NOTIFY_PROMPT_GRACE_MS,
  NOTIFY_PROMPT_MAX_SHOWS,
  nextNotifyPromptRecord,
  notifyPromptBody,
  notifyPromptDue,
  type NotifyPromptFlags,
} from "@/lib/notify-prompt";

const OFF: NotifyPromptFlags = {
  clockReminders: false,
  streaks: false,
  socialPush: false,
  nudges: false,
  rally: false,
};

describe("notifyPromptBody", () => {
  it("names all three when everything is on", () => {
    expect(
      notifyPromptBody({
        clockReminders: true,
        streaks: true,
        socialPush: true,
        nudges: true,
        rally: true,
      })
    ).toBe(
      "Get a heads-up when your clock-in time is up, a reminder before your streak breaks, and a ping when a friend cheers you on."
    );
  });

  it("is null when nothing would arrive, so the sheet doesn't show", () => {
    expect(notifyPromptBody(OFF)).toBeNull();
  });

  it("never promises a server push without SOCIAL_PUSH", () => {
    expect(
      notifyPromptBody({ ...OFF, clockReminders: true, streaks: true, rally: true, nudges: true })
    ).toBe("Get a heads-up when your clock-in time is up.");
  });

  it("names the friend ping by what's live: cheer, then nudge, then likes", () => {
    const social = { ...OFF, socialPush: true };
    expect(notifyPromptBody({ ...social, nudges: true, rally: true })).toBe(
      "Get a ping when a friend cheers you on."
    );
    expect(notifyPromptBody({ ...social, nudges: true })).toBe(
      "Get a ping when a friend nudges you."
    );
    expect(notifyPromptBody(social)).toBe(
      "Get a ping when a friend likes your session."
    );
  });

  it("joins two clauses with 'and', no comma", () => {
    expect(notifyPromptBody({ ...OFF, clockReminders: true, socialPush: true })).toBe(
      "Get a heads-up when your clock-in time is up and a ping when a friend likes your session."
    );
  });
});

describe("notifyPromptDue", () => {
  const onboarded = Date.UTC(2026, 9, 1);
  const later = onboarded + 10 * NOTIFY_PROMPT_GRACE_MS;

  it("is due for a member past their first day who has never seen it", () => {
    expect(notifyPromptDue(null, onboarded, later)).toBe(true);
  });

  it("waits out the first day after onboarding", () => {
    expect(notifyPromptDue(null, onboarded, onboarded + NOTIFY_PROMPT_GRACE_MS - 1)).toBe(false);
    expect(notifyPromptDue(null, onboarded, onboarded + NOTIFY_PROMPT_GRACE_MS)).toBe(true);
  });

  it("never shows without an onboarding time", () => {
    expect(notifyPromptDue(null, null, later)).toBe(false);
    expect(notifyPromptDue(null, Number.NaN, later)).toBe(false);
  });

  it("waits a week after each showing", () => {
    const once = nextNotifyPromptRecord(null, later);
    expect(notifyPromptDue(once, onboarded, later + NOTIFY_PROMPT_GAP_MS - 1)).toBe(false);
    expect(notifyPromptDue(once, onboarded, later + NOTIFY_PROMPT_GAP_MS)).toBe(true);
  });

  it(`stops after ${NOTIFY_PROMPT_MAX_SHOWS} showings`, () => {
    let stored: string | null = null;
    let now = later;
    for (let i = 0; i < NOTIFY_PROMPT_MAX_SHOWS; i++) {
      expect(notifyPromptDue(stored, onboarded, now)).toBe(true);
      stored = nextNotifyPromptRecord(stored, now);
      now += NOTIFY_PROMPT_GAP_MS;
    }
    expect(notifyPromptDue(stored, onboarded, now + 100 * NOTIFY_PROMPT_GAP_MS)).toBe(false);
  });

  it("treats junk in storage as never shown", () => {
    expect(notifyPromptDue("not json", onboarded, later)).toBe(true);
    expect(notifyPromptDue("{}", onboarded, later)).toBe(true);
    expect(nextNotifyPromptRecord("not json", later)).toBe(
      JSON.stringify({ shown: 1, lastAt: later })
    );
  });
});
