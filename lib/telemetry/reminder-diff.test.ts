import { describe, expect, it } from "vitest";

import { HABIT_REMINDER_ID_BASE } from "@/lib/habit-reminders";
import { DURATION_END_ID, HOURLY_ID_BASE } from "@/lib/clock-reminders";
import {
  diffReminderSchedule,
  localNotificationKey,
  reminderTypeForId,
} from "@/lib/telemetry/reminder-diff";

const T = 1_759_900_000_000;

describe("localNotificationKey", () => {
  it("is the reserved shape the event validator accepts, with whole milliseconds", () => {
    expect(localNotificationKey(9101, T)).toBe(`local:9101:${T}`);
    expect(localNotificationKey(9101, T + 0.4)).toBe(`local:9101:${T}`);
  });
});

describe("reminderTypeForId", () => {
  it("maps each reserved range to its family", () => {
    expect(reminderTypeForId(DURATION_END_ID)).toBe("clock_in_reminder");
    expect(reminderTypeForId(HOURLY_ID_BASE + 3)).toBe("clock_in_reminder");
    expect(reminderTypeForId(HABIT_REMINDER_ID_BASE)).toBe("habit_reminder");
    expect(reminderTypeForId(HABIT_REMINDER_ID_BASE + 6)).toBe("habit_reminder");
  });
});

describe("diffReminderSchedule", () => {
  it("reports nothing when the device already holds exactly this schedule", () => {
    const next = [
      { id: 9101, at: T },
      { id: 9102, at: T + 3_600_000 },
    ];
    const prev = next.map((n) => localNotificationKey(n.id, n.at));
    expect(diffReminderSchedule(prev, next)).toEqual({ scheduled: [], cancelled: [] });
  });

  it("a pause (empty schedule) cancels everything still pending", () => {
    const prev = [`local:9101:${T}`, `local:9102:${T + 1}`];
    expect(diffReminderSchedule(prev, [])).toEqual({
      scheduled: [],
      cancelled: prev,
    });
  });

  it("a resume reschedules at new instants: the old ones cancel, the new ones schedule", () => {
    const prev = [`local:9101:${T}`];
    const next = [{ id: 9101, at: T + 60_000 }];
    expect(diffReminderSchedule(prev, next)).toEqual({
      scheduled: next,
      cancelled: prev,
    });
  });

  it("a reminder that already fired is simply absent from pending — never cancelled", () => {
    // iOS drops delivered notifications from getPending(), so the previous
    // list is just shorter; nothing about it reads as a cancellation.
    const prev = [`local:9102:${T + 1}`];
    const next = [{ id: 9102, at: T + 1 }];
    expect(diffReminderSchedule(prev, next)).toEqual({ scheduled: [], cancelled: [] });
  });

  it("a fresh launch with nothing pending schedules everything once", () => {
    const next = [{ id: 9201, at: T }];
    expect(diffReminderSchedule([], next)).toEqual({ scheduled: next, cancelled: [] });
  });

  it("duplicate pending keys collapse", () => {
    const prev = [`local:9101:${T}`, `local:9101:${T}`];
    expect(diffReminderSchedule(prev, [])).toEqual({
      scheduled: [],
      cancelled: [`local:9101:${T}`],
    });
  });
});
