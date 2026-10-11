import { describe, expect, it } from "vitest";

import {
  DEFAULT_HABIT_REMINDER_TIME,
  habitDefaultOnGrant,
  habitReminderPrefFor,
} from "@/lib/habit-reminder-prefs";

describe("habitReminderPrefFor", () => {
  // The product decision: unset means ON at 18:00, so users who granted
  // permission before this feature existed start getting the reminder with no
  // trip to Settings.
  it("defaults to on at 18:00 when nothing has been stored", () => {
    expect(habitReminderPrefFor(null)).toEqual({
      enabled: true,
      time: DEFAULT_HABIT_REMINDER_TIME,
    });
  });

  it("reads an explicit off", () => {
    expect(habitReminderPrefFor('{"off":true}')).toEqual({
      enabled: false,
      time: DEFAULT_HABIT_REMINDER_TIME,
    });
  });

  it("reads a chosen time", () => {
    expect(habitReminderPrefFor('{"time":"07:30"}')).toEqual({
      enabled: true,
      time: "07:30",
    });
  });

  it("keeps the chosen time while off, so re-enabling restores it", () => {
    expect(habitReminderPrefFor('{"off":true,"time":"21:00"}')).toEqual({
      enabled: false,
      time: "21:00",
    });
  });

  it("falls back to the default on garbage", () => {
    expect(habitReminderPrefFor("not json")).toEqual({
      enabled: true,
      time: DEFAULT_HABIT_REMINDER_TIME,
    });
  });

  // A bad time must not surface as a reminder at an invented hour — and it
  // must not silence the feature either. Default time, still on.
  it("falls back to the default time on an invalid stored time", () => {
    expect(habitReminderPrefFor('{"time":"25:99"}')).toEqual({
      enabled: true,
      time: DEFAULT_HABIT_REMINDER_TIME,
    });
  });
});

describe("habitDefaultOnGrant", () => {
  // Onboarding v3 D5: the first ask moved out of the wizard, and both of its
  // new homes turn the reminder on as v2's notify step did, on a grant only.
  it("turns the reminder on for a fresh grant with the feature live", () => {
    expect(habitDefaultOnGrant("granted", true)).toBe(true);
  });

  it("leaves it alone for any other answer, or with the feature dark", () => {
    for (const result of ["denied", "prompt", "unavailable"] as const) {
      expect(habitDefaultOnGrant(result, true)).toBe(false);
    }
    expect(habitDefaultOnGrant("granted", false)).toBe(false);
  });
});
