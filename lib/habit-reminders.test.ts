import { describe, expect, it } from "vitest";

import {
  HABIT_REMINDER_DAYS,
  allHabitReminderIds,
  isHabitReminderId,
} from "@/lib/habit-reminders";

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
