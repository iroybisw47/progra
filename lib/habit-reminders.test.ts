import { describe, expect, it } from "vitest";

import {
  HABIT_REMINDER_DAYS,
  HABIT_REMINDER_ID_BASE,
  allHabitReminderIds,
  habitNameList,
  habitReminderId,
  habitReminders,
  isHabitReminderId,
  parseReminderTime,
} from "@/lib/habit-reminders";

// A fixed "now" mid-morning, well before the default 18:00 fire time. Local
// Date on purpose — the module computes fire instants on the device's wall
// clock, and the tests should exercise exactly that arithmetic.
const NOW = new Date(2026, 7, 18, 9, 30); // Aug 18 2026, 09:30 local
const TODAY = "2026-08-18"; // the localDate NOW falls on

function at(dayOffset: number, hour: number, minute: number): number {
  return new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() + dayOffset,
    hour,
    minute
  ).getTime();
}

describe("habitReminders", () => {
  it("schedules today plus six future days when something is unchecked", () => {
    const out = habitReminders(["Reading"], ["Reading"], TODAY, "18:00", NOW);
    expect(out).toHaveLength(HABIT_REMINDER_DAYS);
    expect(out[0]).toMatchObject({
      id: HABIT_REMINDER_ID_BASE,
      at: at(0, 18, 0),
    });
    expect(out[6]).toMatchObject({
      id: habitReminderId(6),
      at: at(6, 18, 0),
    });
  });

  // The feature's headline behaviour: checking everything off silences TODAY
  // only. Future days still fire if the app never opens again — a new day
  // starts all-unchecked, so the guess is right precisely when it matters.
  it("drops today once everything is checked, keeps the future days", () => {
    const out = habitReminders([], ["Reading", "Meditation"], TODAY, "18:00", NOW);
    expect(out).toHaveLength(HABIT_REMINDER_DAYS - 1);
    expect(out.map((r) => r.id)).not.toContain(HABIT_REMINDER_ID_BASE);
    expect(out[0].id).toBe(habitReminderId(1));
  });

  it("drops today when the fire time has already passed", () => {
    const evening = new Date(2026, 7, 18, 19, 0);
    const out = habitReminders(["Reading"], ["Reading"], TODAY, "18:00", evening);
    expect(out.map((r) => r.id)).not.toContain(HABIT_REMINDER_ID_BASE);
    expect(out).toHaveLength(HABIT_REMINDER_DAYS - 1);
  });

  it("fires at exactly the chosen instant, not at now", () => {
    const out = habitReminders(["Reading"], ["Reading"], TODAY, "06:15", NOW);
    // 06:15 is behind 09:30 today, so the first reminder is tomorrow 06:15.
    expect(out[0].at).toBe(at(1, 6, 15));
  });

  it("returns nothing with no active habits", () => {
    expect(habitReminders([], [], TODAY, "18:00", NOW)).toEqual([]);
  });

  it("returns nothing on an unparseable stored time", () => {
    expect(habitReminders(["Reading"], ["Reading"], TODAY, "6pm", NOW)).toEqual([]);
  });

  // The midnight guard: an unchecked list computed for some OTHER day says
  // nothing about the device's today, so day 0 falls back to all active
  // habits — a new day starts all-unchecked.
  it("treats a stale statusDate as all-unchecked for today", () => {
    const out = habitReminders([], ["Reading"], "2026-08-17", "18:00", NOW);
    expect(out[0].id).toBe(HABIT_REMINDER_ID_BASE);
    expect(out[0].body).toContain("Reading");
  });

  it("rolls the future days across a month boundary on the wall clock", () => {
    const endOfMonth = new Date(2026, 7, 30, 9, 0); // Aug 30
    const out = habitReminders(
      ["Reading"],
      ["Reading"],
      "2026-08-30",
      "18:00",
      endOfMonth
    );
    const last = new Date(out[out.length - 1].at);
    expect(last.getMonth()).toBe(8); // September
    expect(last.getDate()).toBe(5);
    expect(last.getHours()).toBe(18);
  });

  it("speaks singular for one habit, plural for several", () => {
    const one = habitReminders(["Reading"], ["Reading"], TODAY, "18:00", NOW);
    expect(one[0].body).toContain("it helps you grow");
    const two = habitReminders(
      ["Reading", "Meditation"],
      ["Reading", "Meditation"],
      TODAY,
      "18:00",
      NOW
    );
    expect(two[0].body).toContain("these help you grow");
  });

  it("names today's unchecked habits today, all habits on future days", () => {
    const out = habitReminders(
      ["Meditation"],
      ["Reading", "Meditation"],
      TODAY,
      "18:00",
      NOW
    );
    expect(out[0].body).toContain("Meditation");
    expect(out[0].body).not.toContain("Reading");
    expect(out[1].body).toContain("Reading and Meditation");
  });
});

describe("habitNameList", () => {
  it("joins one, two and three names in full", () => {
    expect(habitNameList(["A"])).toBe("A");
    expect(habitNameList(["A", "B"])).toBe("A and B");
    expect(habitNameList(["A", "B", "C"])).toBe("A, B and C");
  });

  it("collapses four or more to a count", () => {
    expect(habitNameList(["A", "B", "C", "D"])).toBe("A, B and 2 more");
    expect(habitNameList(["A", "B", "C", "D", "E"])).toBe("A, B and 3 more");
  });
});

describe("parseReminderTime", () => {
  it("parses HH:MM", () => {
    expect(parseReminderTime("18:00")).toEqual({ hour: 18, minute: 0 });
    expect(parseReminderTime("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseReminderTime("23:59")).toEqual({ hour: 23, minute: 59 });
  });

  it("rejects out-of-range and malformed values", () => {
    expect(parseReminderTime("24:00")).toBeNull();
    expect(parseReminderTime("12:60")).toBeNull();
    expect(parseReminderTime("9:00")).toBeNull();
    expect(parseReminderTime("")).toBeNull();
    expect(parseReminderTime("six pm")).toBeNull();
  });
});

describe("id range", () => {
  // The clock owns 9001/9002 and 9101–9110; a collision would let one family's
  // wholesale cancel destroy the other's schedule.
  it("stays clear of the clock's reserved ids", () => {
    const ids = allHabitReminderIds();
    expect(ids).toHaveLength(HABIT_REMINDER_DAYS);
    expect(Math.min(...ids)).toBe(9201);
    expect(Math.max(...ids)).toBe(9207);
  });

  // What the tap router discriminates on — the bounds are the contract.
  it("isHabitReminderId matches exactly the reserved range", () => {
    expect(isHabitReminderId(9200)).toBe(false);
    expect(isHabitReminderId(9201)).toBe(true);
    expect(isHabitReminderId(9207)).toBe(true);
    expect(isHabitReminderId(9208)).toBe(false);
    expect(isHabitReminderId(undefined)).toBe(false);
  });
});
