import { describe, expect, it } from "vitest";

import { allReminderIds } from "@/lib/clock-reminders";
import { allHabitReminderIds } from "@/lib/habit-reminders";

// Two independent local-notification families schedule against ONE device-wide
// id space. Nothing in the type system stops their reserved ranges from
// overlapping, and an overlap is silent: whichever family syncs last wins, and
// the other's reminders vanish — or worse, one family's "cancel my whole range"
// deletes the other's pending notifications.
//
// The ranges are currently clock 9001/9002 + 9101.. and habits 9201.., derived
// from constants that can drift (MAX_HOURLY_REMINDERS is computed from
// SESSION_CAP_MS, so raising the session cap grows the clock range upward
// toward the habit base). This is the test that catches that.
describe("local notification id ranges", () => {
  const clock = allReminderIds();
  const habit = allHabitReminderIds();

  it("never overlap", () => {
    const overlap = clock.filter((id) => habit.includes(id));
    expect(overlap).toEqual([]);
  });

  it("are each internally unique", () => {
    expect(new Set(clock).size).toBe(clock.length);
    expect(new Set(habit).size).toBe(habit.length);
  });

  // Raising SESSION_CAP_MS grows the clock's hourly range. If it ever reaches
  // the habit base the families collide, so assert the headroom directly.
  it("leave the clock range below the habit range", () => {
    expect(Math.max(...clock)).toBeLessThan(Math.min(...habit));
  });
});
